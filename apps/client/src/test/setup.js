import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Node 25 מגדיר localStorage גלובלי משלו (שלא עובד בלי --localstorage-file), והוא מסתיר את זה של jsdom.
// בבדיקות משתמשים באחסון פשוט בזיכרון, עם אותו ממשק כמו בדפדפן.
class MemoryStorage {
  data = new Map();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  key(index) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key) {
    this.data.delete(key);
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
}
Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true, writable: true });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom לא מממש את הפונקציות האלה
URL.createObjectURL = vi.fn(() => "blob:preview");
URL.revokeObjectURL = vi.fn();

// jsdom לא מממש את showModal/close של <dialog>; מימוש מינימלי שמתנהג כמו בדפדפן
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
