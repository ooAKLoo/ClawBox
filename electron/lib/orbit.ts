import { app } from "electron";

let Orbit: any = null;

export async function initOrbit() {
  try {
    const mod = await import("@ooakloowj/orbit");
    Orbit = mod.Orbit ?? mod.default?.Orbit ?? mod.default;
    if (!Orbit?.configure) {
      console.warn("[orbit] Orbit.configure not found, SDK may be incompatible");
      return;
    }
    Orbit.configure({
      appId: "com.example.clawbox",
      // Desktop app: auto-track downloads & DAU
    });
    console.log("[orbit] SDK initialized");
  } catch (err) {
    console.warn("[orbit] Failed to initialize:", err);
  }
}

export async function checkUpdate(): Promise<{
  hasUpdate: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  forceUpdate?: boolean;
  downloadUrl?: string;
  currentVersion: string;
}> {
  const currentVersion = app.getVersion();
  if (!Orbit?.checkUpdate) {
    return { hasUpdate: false, currentVersion };
  }
  try {
    const result = await Orbit.checkUpdate();
    return { ...result, currentVersion };
  } catch (err) {
    console.warn("[orbit] checkUpdate failed:", err);
    return { hasUpdate: false, currentVersion };
  }
}

export async function sendFeedback(data: {
  content: string;
  contact?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!Orbit?.sendFeedback) {
    return { success: false, error: "Orbit SDK not available" };
  }
  try {
    await Orbit.sendFeedback(data);
    return { success: true };
  } catch (err: any) {
    console.warn("[orbit] sendFeedback failed:", err);
    return { success: false, error: err?.message ?? String(err) };
  }
}
