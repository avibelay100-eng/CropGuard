"""
CropGuard AI Engine - המרה חד-פעמית של המודל מ-Keras ל-ONNX.

למה זה קיים?
    שירות ה-AI כתוב ב-TypeScript ומריץ את המודל עם onnxruntime-node.
    Node לא יודע לקרוא קובץ ‎.keras, ולכן ממירים אותו פעם אחת לקובץ ‎.onnx.
    זה הקובץ היחיד בשירות שכתוב ב-Python, והוא לא נדרש בזמן ריצה.

שימוש (מתוך התיקייה services/ai_engine):
    python tools/convert_to_onnx.py

דרישות (רק להמרה):
    pip install tensorflow tf2onnx onnx onnxruntime "keras<3.16"

    חשוב: להשתמש בגרסה יציבה של Keras. בגרסת הפיתוח 3.16.0.dev שכבות
    האוגמנטציה פעלו גם ב-predict, והתוצאות השתנו בין הרצה להרצה על אותה תמונה.

הסקריפט:
    1. טוען את model/cropora_model.keras
    2. ממיר ל-model/cropora_model.onnx (קלט בשם "image", צורה [N,224,224,3], float32)
    3. בודק שהתוצאות של ONNX זהות לתוצאות של Keras (אם onnxruntime מותקן)
"""

import argparse
import sys
from pathlib import Path

import numpy as np

# תיקיית השירות (services/ai_engine) ותיקיית המודל שבתוכה
SERVICE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = SERVICE_DIR / "model"

# שם הקלט בקובץ ה-ONNX. קוד ה-TypeScript מחפש את הקלט הראשון, אבל שם קבוע עוזר בדיבאג.
INPUT_NAME = "image"
IMAGE_SIZE = 224
CLASS_COUNT = 38

# סטייה מקסימלית מותרת בין ההסתברויות של Keras ל-ONNX
MAX_ABS_DIFF = 1e-4

# שכבות אוגמנטציה שפועלות רק באימון. בזמן תחזית הן לא עושות כלום,
# אבל הגרף שלהן כולל פעולות אקראיות ש-ONNX לא תומך בהן (StatelessRandomUniformV2).
AUGMENTATION_LAYERS = {
    "RandomFlip", "RandomRotation", "RandomZoom", "RandomTranslation",
    "RandomContrast", "RandomBrightness", "RandomCrop",
}


def disable_augmentation(model) -> list:
    """מחליף כל שכבת אוגמנטציה (גם בתוך מודלים מקוננים) בפעולת זהות. מחזיר את שמות השכבות."""
    disabled = []

    def identity(inputs, *args, **kwargs):
        return inputs

    def visit(layer):
        if layer.__class__.__name__ in AUGMENTATION_LAYERS:
            layer.call = identity
            disabled.append(layer.name)
        for child in getattr(layer, "layers", []):
            visit(child)

    visit(model)
    return disabled


def convert(keras_path: Path, onnx_path: Path, opset: int) -> None:
    import tensorflow as tf
    import tf2onnx

    print(f"טוען מודל Keras מ-{keras_path}")
    model = tf.keras.models.load_model(keras_path, compile=False)

    disabled = disable_augmentation(model)
    print(f"שכבות אוגמנטציה שנוטרלו להמרה: {disabled or 'אין'}")

    # חתימת קלט: מספר תמונות כלשהו, 224x224, שלושה ערוצי RGB, ערכים גולמיים 0..255.
    # המודל מנרמל ל-[-1, 1] בתוך הגרף שלו, כך שאין לחלק ב-255 לפני ההרצה.
    signature = (tf.TensorSpec((None, IMAGE_SIZE, IMAGE_SIZE, 3), tf.float32, name=INPUT_NAME),)

    @tf.function(input_signature=signature)
    def serve(image):
        return model(image, training=False)

    print(f"ממיר ל-ONNX (opset {opset})...")
    tf2onnx.convert.from_function(serve, input_signature=signature, opset=opset, output_path=str(onnx_path))
    print(f"נשמר: {onnx_path} ({onnx_path.stat().st_size / 1_000_000:.1f} MB)")


def check_structure(onnx_path: Path) -> None:
    import onnx

    model = onnx.load(str(onnx_path))
    onnx.checker.check_model(model)
    inputs = [i.name for i in model.graph.input]
    outputs = [o.name for o in model.graph.output]
    if len(inputs) != 1 or len(outputs) != 1:
        raise SystemExit(f"שגיאה: ציפינו לקלט אחד ופלט אחד, קיבלנו {inputs} -> {outputs}")
    print(f"מבנה תקין: קלט {inputs[0]!r}, פלט {outputs[0]!r}")


def check_parity(keras_path: Path, onnx_path: Path) -> None:
    try:
        import onnxruntime as ort
    except ImportError:
        print("אזהרה: onnxruntime לא מותקן, מדלג על בדיקת ההתאמה מול Keras")
        return
    import tensorflow as tf

    # קלטים קבועים (seed) כדי שהבדיקה תהיה ניתנת לשחזור
    rng = np.random.default_rng(42)
    batch = rng.uniform(0, 255, (4, IMAGE_SIZE, IMAGE_SIZE, 3)).astype(np.float32)

    keras_model = tf.keras.models.load_model(keras_path, compile=False)
    expected = keras_model.predict(batch, verbose=0)

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    actual = session.run(None, {session.get_inputs()[0].name: batch})[0]

    if actual.shape != (4, CLASS_COUNT):
        raise SystemExit(f"שגיאה: צורת פלט לא צפויה {actual.shape}")
    diff = float(np.max(np.abs(actual - expected)))
    same_top1 = bool(np.all(actual.argmax(1) == expected.argmax(1)))
    print(f"סטייה מקסימלית מול Keras: {diff:.2e}, אותה תחזית מובילה: {same_top1}")
    if diff > MAX_ABS_DIFF or not same_top1:
        raise SystemExit("שגיאה: תוצאות ONNX שונות מדי מתוצאות Keras")


def main() -> None:
    parser = argparse.ArgumentParser(description="המרת מודל CropGuard מ-Keras ל-ONNX")
    parser.add_argument("--keras", type=Path, default=MODEL_DIR / "cropora_model.keras")
    parser.add_argument("--onnx", type=Path, default=MODEL_DIR / "cropora_model.onnx")
    parser.add_argument("--opset", type=int, default=17)
    args = parser.parse_args()

    if not args.keras.is_file():
        sys.exit(f"שגיאה: קובץ המודל לא נמצא: {args.keras}")

    convert(args.keras, args.onnx, args.opset)
    check_structure(args.onnx)
    check_parity(args.keras, args.onnx)
    print("ההמרה הסתיימה בהצלחה")


if __name__ == "__main__":
    main()
