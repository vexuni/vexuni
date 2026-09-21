import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./icons";

type Tone = "ok" | "err";
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => {});

/** Push a transient notification. Available under <ToastProvider>. */
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = ++nextId.current;
    setItems((xs) => [...xs.slice(-3), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3400);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            <Icon name={item.tone === "err" ? "alert" : "check"} size={14} />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
