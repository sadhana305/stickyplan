export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  opts?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(path, {
    method: opts?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong. Please try again.", res.status);
  return data;
}

export function readFileAsBase64(file: File): Promise<{ base64: string; mime: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [meta, base64] = result.split(",");
      const mime = meta?.match(/data:([^;]+)/)?.[1] ?? (file.type || "application/octet-stream");
      resolve({ base64: base64 ?? "", mime, name: file.name });
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const SUBJECT_COLORS: Record<string, { chip: string; dot: string; bar: string }> = {
  mint: { chip: "bg-mint-soft text-teal-900 dark:text-teal-100", dot: "bg-mint", bar: "bg-mint" },
  lavender: { chip: "bg-lavender-soft text-violet-900 dark:text-violet-100", dot: "bg-lavender", bar: "bg-lavender" },
  peach: { chip: "bg-peach-soft text-orange-900 dark:text-orange-100", dot: "bg-peach", bar: "bg-peach" },
  sky: { chip: "bg-sky-soft text-sky-900 dark:text-sky-100", dot: "bg-sky", bar: "bg-sky" },
  lemon: { chip: "bg-lemon-soft text-yellow-900 dark:text-yellow-100", dot: "bg-lemon", bar: "bg-lemon" },
  rose: { chip: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100", dot: "bg-rose-400 dark:bg-rose-500", bar: "bg-rose-400 dark:bg-rose-500" },
};

export function subjectColor(key: string | null | undefined) {
  return SUBJECT_COLORS[key ?? "mint"] ?? SUBJECT_COLORS.mint;
}

export const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "bg-mint-soft text-teal-800 dark:text-teal-100",
  MEDIUM: "bg-lemon-soft text-yellow-900 dark:text-yellow-100",
  HARD: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};
