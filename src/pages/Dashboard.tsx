import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check, RotateCcw, Eye, EyeOff } from "lucide-react";
import { useDashboardLayout, WIDGET_LABELS, WIDGET_ICONS } from "@/hooks/useDashboardLayout";
import type { WidgetLayoutItem } from "@/hooks/useDashboardLayout";
import { WidgetShell } from "@/components/widgets/WidgetShell";
import { WidgetContent } from "@/components/widgets/WidgetContent";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { hasFeatureAccess, WIDGET_FEATURE_KEY } from "@/lib/features";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAP     = 18;

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  const { layout: fullLayout, updateWidget, resetLayout } = useDashboardLayout();
  const { role, loading: roleLoading } = useEffectiveRole();
  const { profile, loading: profileLoading } = useUserProfile();

  const layout = fullLayout.filter((w) => {
    const key = WIDGET_FEATURE_KEY[w.type];
    if (!key) return true;
    if (roleLoading || profileLoading) return false;
    return hasFeatureAccess(role, profile?.enabledFeatures ?? [], key);
  });

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Total canvas height from widget bottom edges
  const canvasHeight = layout.reduce((max, w) => Math.max(max, w.y + w.h + GAP), 100);

  const hiddenWidgets = layout.filter((w) => !w.visible);

  const handleUpdate = useCallback((id: string, patch: Partial<WidgetLayoutItem>) => {
    updateWidget(id, patch);
  }, [updateWidget]);

  return (
    <div className="mx-auto w-full max-w-6xl pb-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-3 sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <p className="text-sm font-semibold text-foreground">Dashboard</p>
        <div className="flex items-center gap-2">
          {editMode && hiddenWidgets.length > 0 && (
            <button
              onClick={() => setShowHiddenPanel((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5"
            >
              <EyeOff className="w-3.5 h-3.5" />
              {hiddenWidgets.length} hidden
            </button>
          )}
          {editMode && (
            <button
              onClick={resetLayout}
              className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5"
              title="Reset to default layout"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={() => { setEditMode((v) => !v); setShowHiddenPanel(false); }}
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 transition-all ${
              editMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {editMode ? <><Check className="w-3.5 h-3.5" /> Done</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
          </button>
        </div>
      </div>

      {/* Edit mode banner */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mt-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary/80"
          >
            🖐️ Drag widgets to reposition · Drag corner to resize · Tap 👁️ to hide/show
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden widgets panel */}
      <AnimatePresence>
        {editMode && showHiddenPanel && hiddenWidgets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mt-2 p-3 rounded-xl bg-muted/40 border border-border"
          >
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Hidden widgets — tap to restore
            </p>
            <div className="flex flex-wrap gap-2">
              {hiddenWidgets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => updateWidget(w.id, { visible: true })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span>{WIDGET_ICONS[w.type]}</span>
                  {WIDGET_LABELS[w.type]}
                  <Eye className="w-3 h-3 text-primary ml-0.5" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget canvas */}
      <div
        ref={containerRef}
        className="relative mx-4 sm:mx-5"
        style={{
          height: `${canvasHeight + 32}px`,
          marginTop: `${GAP}px`,
        }}
      >
        {containerWidth > 0 && layout.map((item) => {
          if (!item.visible && !editMode) return null;

          return (
            <WidgetShell
              key={item.id}
              item={item}
              containerWidth={containerWidth}
              editMode={editMode}
              onUpdate={handleUpdate}
            >
              <WidgetContent type={item.type} />
            </WidgetShell>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
