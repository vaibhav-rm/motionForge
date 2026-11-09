"use client";

import { create } from "zustand";
import type { Project, Scene, Element } from "@motionforge/video-schema";
import { normaliseSceneOrder, SceneSchema } from "@motionforge/video-schema";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  changes?: string[];
  pending?: boolean;
};

type Snapshot = { project: Project; label: string };

type EditorState = {
  project: Project | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  dirty: boolean;
  lastSavedAt: number | null;

  selectedSceneId: string | null;
  selectedElementId: string | null;
  playing: boolean;
  currentFrame: number;

  messages: ChatMsg[];
  aiBusy: boolean;

  undoStack: Snapshot[];
  redoStack: Snapshot[];

  setProject: (p: Project, opts?: { markClean?: boolean }) => void;
  patchProject: (fn: (p: Project) => Project, label?: string) => void;
  selectScene: (id: string | null) => void;
  selectElement: (id: string | null) => void;
  setPlaying: (v: boolean) => void;
  setCurrentFrame: (f: number) => void;
  setMessages: (m: ChatMsg[]) => void;
  addMessage: (m: ChatMsg) => void;
  updateMessage: (id: string, patch: Partial<ChatMsg>) => void;
  setAiBusy: (v: boolean) => void;
  setSaving: (v: boolean) => void;
  setError: (e: string | null) => void;
  markSaved: () => void;
  undo: () => void;
  redo: () => void;

  updateScene: (sceneId: string, patch: Partial<Scene>, label?: string) => void;
  updateElement: (
    sceneId: string,
    elementId: string,
    patch: Partial<Element>,
    label?: string,
  ) => void;
  addScene: (afterId?: string | null) => void;
  removeScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  reorderScene: (sceneId: string, toIndex: number) => void;
};

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  loading: true,
  error: null,
  saving: false,
  dirty: false,
  lastSavedAt: null,
  selectedSceneId: null,
  selectedElementId: null,
  playing: false,
  currentFrame: 0,
  messages: [],
  aiBusy: false,
  undoStack: [],
  redoStack: [],

  setProject: (p, opts) =>
    set((s) => ({
      project: p,
      loading: false,
      error: null,
      dirty: opts?.markClean ? false : s.dirty,
      selectedSceneId:
        s.selectedSceneId && p.scenes.some((sc) => sc.id === s.selectedSceneId)
          ? s.selectedSceneId
          : p.scenes[0]?.id ?? null,
    })),

  patchProject: (fn, label) =>
    set((s) => {
      if (!s.project) return s;
      const prev = clone(s.project);
      const next = fn(clone(s.project));
      next.updatedAt = new Date().toISOString();
      const undoStack = [...s.undoStack, { project: prev, label: label ?? "Edit" }].slice(-60);
      return { project: next, dirty: true, undoStack, redoStack: [] };
    }),

  selectScene: (id) => set({ selectedSceneId: id, selectedElementId: null, currentFrame: 0 }),
  selectElement: (id) => set({ selectedElementId: id }),
  setPlaying: (v) => set({ playing: v }),
  setCurrentFrame: (f) => set({ currentFrame: Math.max(0, Math.floor(f)) }),
  setMessages: (m) => set({ messages: m }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  setAiBusy: (v) => set({ aiBusy: v }),
  setSaving: (v) => set({ saving: v }),
  setError: (e) => set({ error: e }),
  markSaved: () => set({ saving: false, dirty: false, lastSavedAt: Date.now() }),

  undo: () =>
    set((s) => {
      if (!s.project || s.undoStack.length === 0) return s;
      const undoStack = [...s.undoStack];
      const snap = undoStack.pop()!;
      const redoStack = [...s.redoStack, { project: clone(s.project), label: snap.label }];
      return { project: snap.project, dirty: true, undoStack, redoStack: redoStack.slice(-60) };
    }),
  redo: () =>
    set((s) => {
      if (!s.project || s.redoStack.length === 0) return s;
      const redoStack = [...s.redoStack];
      const snap = redoStack.pop()!;
      const undoStack = [...s.undoStack, { project: clone(s.project), label: snap.label }];
      return { project: snap.project, dirty: true, undoStack, redoStack };
    }),

  updateScene: (sceneId, patch, label) =>
    get().patchProject((p) => ({
      ...p,
      scenes: p.scenes.map((sc) => (sc.id === sceneId ? { ...sc, ...patch } : sc)),
    }), label ?? "Update scene"),

  updateElement: (sceneId, elementId, patch, label) =>
    get().patchProject((p) => ({
      ...p,
      scenes: p.scenes.map((sc) =>
        sc.id !== sceneId
          ? sc
          : {
              ...sc,
              elements: sc.elements.map((el) =>
                el.id === elementId ? ({ ...el, ...patch } as Element) : el,
              ),
            },
      ),
    }), label ?? "Update element"),

  addScene: (afterId) =>
    get().patchProject((p) => {
      const idx = afterId ? p.scenes.findIndex((s) => s.id === afterId) : p.scenes.length - 1;
      const scene = SceneSchema.parse({
        id: rid("sc"),
        name: `Scene ${p.scenes.length + 1}`,
        order: 0,
        durationInFrames: 150,
        description: "",
        background: { type: "linearGradient", color: p.style.palette.background, color2: p.style.palette.surface, angle: 140, assetId: null, gridSize: 72, opacity: 1, animated: true },
        camera: { zoomFrom: 1.04, zoomTo: 1, panXFrom: 0, panXTo: 0, panYFrom: 0, panYTo: 0, rotateFrom: 0, rotateTo: 0, easing: "easeInOut" },
        transition: { type: "fade", durationInFrames: 16, easing: "easeInOut" },
        elements: [
          {
            id: rid("el"),
            type: "text",
            name: "New scene",
            visible: true,
            locked: false,
            x: 50, y: 50, width: null, height: null, scale: 1, rotation: 0, opacity: 1, zIndex: 1,
            offsetInFrames: 0, durationInFrames: null,
            text: "Describe this scene to the AI assistant.",
            variant: "heading",
            color: p.style.palette.text,
            fontFamily: "display",
            align: "center",
            maxWidth: 900,
            lineHeight: 1.15,
            letterSpacing: -0.02,
            uppercase: false,
            accentColor: p.style.palette.primary,
            shadow: 0.3,
            animation: {
              entrance: { type: "maskUp", durationInFrames: 24, delayInFrames: 0, staggerInFrames: 2, easing: "easeOut", distance: 80 },
              exit: { type: "fade", durationInFrames: 14, delayInFrames: 0, easing: "easeIn", distance: 50 },
              loop: { type: "none", periodInFrames: 60, amplitude: 12 },
            },
          },
        ],
        audio: [],
        notes: "",
      });
      const scenes = [...p.scenes];
      scenes.splice(idx + 1, 0, scene);
      return { ...p, scenes: normaliseSceneOrder(scenes) };
    }, "Add scene"),

  removeScene: (sceneId) =>
    get().patchProject((p) => {
      if (p.scenes.length <= 1) return p;
      return { ...p, scenes: normaliseSceneOrder(p.scenes.filter((s) => s.id !== sceneId)) };
    }, "Remove scene"),

  duplicateScene: (sceneId) =>
    get().patchProject((p) => {
      const idx = p.scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return p;
      const src = clone(p.scenes[idx]);
      const copy = { ...src, id: rid("sc"), name: `${src.name} copy`, elements: src.elements.map((e) => ({ ...e, id: rid("el") })) };
      const scenes = [...p.scenes];
      scenes.splice(idx + 1, 0, copy);
      return { ...p, scenes: normaliseSceneOrder(scenes) };
    }, "Duplicate scene"),

  reorderScene: (sceneId, toIndex) =>
    get().patchProject((p) => {
      const scenes = [...p.scenes];
      const from = scenes.findIndex((s) => s.id === sceneId);
      if (from < 0) return p;
      const [m] = scenes.splice(from, 1);
      scenes.splice(Math.max(0, Math.min(scenes.length, toIndex)), 0, m);
      return { ...p, scenes: normaliseSceneOrder(scenes) };
    }, "Reorder scenes"),
}));
