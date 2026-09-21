"use client";
import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { mountPlanningSurface, type PlanningSurfaceOptions } from "./surface";
import type { PlanningSession, PlanningSessionState } from "./session";
import "./styles.css";

export const PlanningContext = createContext<PlanningSession | undefined>(undefined);
const EMPTY_STATE: PlanningSessionState = {busy: false};
const noSubscribe = () => () => undefined;
export function usePlanningState() {
  const session = useContext(PlanningContext);
  const state = useSyncExternalStore(session?.subscribe ?? noSubscribe, session?.getState ?? (() => EMPTY_STATE), () => EMPTY_STATE);
  return {session, state};
}
/** The planning dialog; the timeline is a React component of its own. */
export function PlanningSurface(props: PlanningSurfaceOptions) {
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<ReturnType<typeof mountPlanningSurface> | undefined>(undefined);
  const latest = useRef(props); latest.current = props;
  useEffect(() => {
    if (!root.current) { return; }
    surface.current = mountPlanningSurface(root.current, {...latest.current, session: props.session});
    return () => {surface.current?.destroy(); surface.current = undefined;};
  }, [props.session]);
  useEffect(() => {surface.current?.update(props);});
  return <div data-planning-surface="overlay" ref={root} />;
}
