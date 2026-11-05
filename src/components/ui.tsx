"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Alert from "@radix-ui/react-alert-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
const variants = cva("button", {
  variants: {
    variant: {
      default: "button-primary",
      outline: "button-outline",
      ghost: "button-ghost",
      danger: "button-danger",
    },
    size: { default: "", icon: "button-icon", small: "button-small" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(variants({ variant, size }), className)}
      {...props}
    />
  );
}
export function Field({
  label,
  error,
  children,
  hint,
}: React.PropsWithChildren<{ label: string; error?: string; hint?: string }>) {
  const id = React.useId();
  let controlId = id,
    assigned = false;
  const bind = (nodes: React.ReactNode): React.ReactNode =>
    React.Children.map(nodes, (node) => {
      if (!React.isValidElement<Record<string, unknown>>(node)) return node;
      if (
        typeof node.type === "string" &&
        ["input", "select", "textarea"].includes(node.type) &&
        !assigned
      ) {
        assigned = true;
        controlId = typeof node.props.id === "string" ? node.props.id : id;
        return React.cloneElement(node, {
          id: controlId,
          "aria-describedby": hint || error ? `${id}-help` : undefined,
          "aria-invalid": !!error,
        });
      }
      return node.props.children
        ? React.cloneElement(node, {
            children: bind(node.props.children as React.ReactNode),
          })
        : node;
    });
  const controls = bind(children);
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {controls}
      {hint && !error && <small id={`${id}-help`}>{hint}</small>}
      {error && (
        <small role="alert" className="error" id={`${id}-help`}>
          {error}
        </small>
      )}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: React.PropsWithChildren<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  wide?: boolean;
}>) {
  const descriptionId = React.useId();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={cn("modal", wide && "modal-wide")}
          aria-describedby={description ? descriptionId : undefined}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id={descriptionId}>
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Schliessen">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">/</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
type ConfirmOptions = {
  title: string;
  text: string;
  label?: string;
  danger?: boolean;
};
const ConfirmContext = React.createContext<
  (options: ConfirmOptions) => Promise<boolean>
>(async () => false);
const ToastContext = React.createContext<(text: string) => void>(() => {});
export const useConfirm = () => React.useContext(ConfirmContext);
export const useToast = () => React.useContext(ToastContext);
export function FeedbackProvider({ children }: React.PropsWithChildren) {
  const [confirmation, setConfirmation] = React.useState<ConfirmOptions | null>(
      null,
    ),
    [toast, setToast] = React.useState("");
  const resolver = React.useRef<((v: boolean) => void) | null>(null);
  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setConfirmation(options);
      }),
    [],
  );
  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setConfirmation(null);
  };
  React.useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  return (
    <ToastContext.Provider value={setToast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div className="toast-region" role="status" aria-live="polite">
          {toast && (
            <div className="toast">
              {toast}
              <button
                aria-label="Meldung schliessen"
                onClick={() => setToast("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
        <Alert.Root
          open={!!confirmation}
          onOpenChange={(v) => {
            if (!v) close(false);
          }}
        >
          <Alert.Portal>
            <Alert.Overlay className="overlay" />
            <Alert.Content className="modal confirm-modal">
              <Alert.Title>{confirmation?.title}</Alert.Title>
              <Alert.Description>{confirmation?.text}</Alert.Description>
              <div className="actions">
                <Button variant="outline" onClick={() => close(false)}>
                  Abbrechen
                </Button>
                <Button
                  variant={confirmation?.danger ? "danger" : "default"}
                  onClick={() => close(true)}
                >
                  {confirmation?.label ?? "Bestätigen"}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </Alert.Content>
          </Alert.Portal>
        </Alert.Root>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
