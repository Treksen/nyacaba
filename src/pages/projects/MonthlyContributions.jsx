import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNotifyError } from "../../lib/useNotifyError";
import { formatMoney } from "../../lib/format";
import { MONTHS } from "../../lib/constants";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Modal from "../../components/ui/Modal";
import { Link, useNavigate } from "react-router-dom";


const MONTHLY_TARGET = 200; // KSh per member per month

export default function MonthlyContributions() {
  const { canManageFinances: isAdmin, isStaff, profile } = useAuth();
  const toast = useToast();
  const notifyError = useNotifyError();
  const navigate = useNavigate();

  const [periods, setPeriods] = useState([]);
  const [activeMembers, setActiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // period id currently expanded
  const [breakdown, setBreakdown] = useState({}); // { [periodId]: { paid: [], unpaid: [] } }
  const [loadingBreakdown, setLoadingBreakdown] = useState(null);

  // Create period modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    year: currentYear,
    month: new Date().getMonth() + 1,
    target_amount: MONTHLY_TARGET,
    notes: "",
  });

  const [periodStats, setPeriodStats] = useState({}); // { [periodId]: { totalCollected, paidCount, ... } }

  async function load() {
    setLoading(true);
    const [{ data: periodsData }, { data: membersData }] = await Promise.all([
      supabase
        .from("monthly_periods")
        .select("id, year, month, target_amount, notes")
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
      supabase
        .from("members")
        .select("id, full_name, status")
        .eq("status", "active"),
    ]);
    setPeriods(periodsData || []);
    setActiveMembers(membersData || []);

    // Load aggregate stats for all periods via SECURITY DEFINER RPC
    // so members see the real church-wide totals, not just their own
    if (periodsData && periodsData.length > 0) {
      const statsResults = await Promise.all(
        periodsData.map((p) =>
          supabase.rpc('period_stats', { p_period_id: p.id }).then(({ data }) => ({ id: p.id, stats: data }))
        )
      );
      const statsMap = {};
      statsResults.forEach(({ id, stats }) => { if (stats) statsMap[id] = stats; });
      setPeriodStats(statsMap);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadBreakdown(periodId) {
    if (breakdown[periodId]) return; // already loaded
    setLoadingBreakdown(periodId);

    const { data: contribs } = await supabase
      .from("contributions")
      .select(
        "member_id, amount, verification_status, contribution_date, members(full_name)",
      )
      .eq("period_id", periodId)
      .eq("contribution_type", "monthly");

    const paidIds = new Set((contribs || []).map((c) => c.member_id));
    const paid = (contribs || []).map((c) => ({
      id: c.member_id,
      name: c.members?.full_name || "Unknown",
      amount: Number(c.amount),
      status: c.verification_status,
      date: c.contribution_date,
    }));
    const unpaid = activeMembers
      .filter((m) => !paidIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.full_name }));

    setBreakdown((prev) => ({ ...prev, [periodId]: { paid, unpaid } }));
    setLoadingBreakdown(null);
  }

  function toggleExpand(periodId) {
    // block members
    if (!isAdmin) return;

    if (expanded === periodId) {
      setExpanded(null);
    } else {
      setExpanded(periodId);
      loadBreakdown(periodId);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      year: parseInt(form.year),
      month: parseInt(form.month),
      target_amount: parseFloat(form.target_amount),
      notes: form.notes || null,
    };

    const { error } = editing
      ? await supabase
          .from("monthly_periods")
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("monthly_periods").insert({
          ...payload,
          created_by: profile?.id,
        });
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("This month already exists.");
      else notifyError(error, { action: "MonthlyContributions" });
    } else {
      toast.success(editing ? "Month updated" : "Month created");
      setOpen(false);
      setEditing(null);
      load();
    }
  }

  async function handleDelete(period) {
    if (!window.confirm(`Delete ${MONTHS[period.month - 1]} ${period.year}?`))
      return;

    const { error } = await supabase
      .from("monthly_periods")
      .delete()
      .eq("id", period.id);

    if (error) {
      notifyError(error, { action: "Delete Monthly Period" });
    } else {
      toast.success("Month deleted");
      load();
    }
  }

  function handleEdit(period) {
    setEditing(period);
    setForm({
      year: period.year,
      month: period.month,
      target_amount: period.target_amount,
      notes: period.notes || "",
    });
    setOpen(true);
  }
  // ── Summary stats for a period ──────────────────────────────────────────
  function getPeriodStats(period) {
    const s = periodStats[period.id];
    if (s) {
      return {
        totalCollected: Number(s.total_collected || 0),
        paidCount:      Number(s.paid_count      || 0),
        unpaidCount:    Number(s.unpaid_count     || 0),
        target:         Number(s.target           || 0),
        pct:            Number(s.pct              || 0),
      };
    }
    return { totalCollected: 0, paidCount: 0, unpaidCount: 0, target: 0, pct: 0 };
  }

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* <div>
        <Link
          to="/projects"
          className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Projects
        </Link>
      </div> */}

      {isAdmin && (
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={16} /> New Month
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-600">
            Target: <strong>{formatMoney(MONTHLY_TARGET)}</strong> per active
            member·
          </p>
        </div>
      </div>

      {/* Period list */}
      {periods.length === 0 ? (
        <div className="card-padded text-center py-12">
          <p className="text-ink-600 text-sm">
            No monthly periods created yet.
          </p>
          {isAdmin && (
            <button onClick={() => setOpen(true)} className="btn-primary mt-4">
              <Plus size={16} /> Create First Month
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((period) => {
            const { totalCollected, paidCount, unpaidCount, target, pct } =
              getPeriodStats(period);
            const isExpanded = expanded === period.id;
            const bd = breakdown[period.id];

            return (
              <div
                key={period.id}
                className={`card-padded transition ${
                  isStaff
                    ? "cursor-pointer hover:bg-cream-50"
                    : "cursor-default"
                }`}
                onClick={() => {
                  if (!isStaff) return; // members see progress only, no detail
                  navigate(`/projects/monthly/${period.id}`);
                }}
              >
                {/* Period header row */}
                <button
                  type="button"
                  onClick={() => isStaff && toggleExpand(period.id)}
                  className={`w-full text-left ${isStaff ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold">
                        {MONTHS[period.month - 1]} {period.year}
                      </h3>
                      {period.notes && (
                        <p className="text-xs text-ink-500 mt-0.5">
                          {period.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Stats pills */}
                      <div className="hidden sm:flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={14} />
                          {paidCount} paid
                        </span>
                        <span className="flex items-center gap-1 text-rose-700">
                          <XCircle size={14} />
                          {unpaidCount} unpaid
                        </span>
                        <span className="flex items-center gap-1 text-primary-900 font-semibold">
                          <TrendingUp size={14} />
                          {formatMoney(totalCollected)}
                        </span>
                      </div>
                      {isAdmin && (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(period);
                            }}
                            className="p-2 rounded-lg hover:bg-cream-100"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(period);
                            }}
                            className="p-2 rounded-lg hover:bg-rose-100 text-rose-700"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                      {/* {isExpanded ? (
                        <ChevronUp size={18} className="text-ink-500" />
                      ) : (
                        <ChevronDown size={18} className="text-ink-500" />
                      )} */}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full bg-cream-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-700 to-primary-900 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-primary-900 w-10 text-right">
                      {pct}%
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-ink-500 mt-1">
                    <span>{formatMoney(totalCollected)} collected</span>
                    <span>Target: {formatMoney(target)}</span>
                  </div>
                  {/* </div> */}
                </button>

                {/* Expanded breakdown — staff only */}
                {isExpanded && isStaff && (
                  <div className="mt-4 pt-4 border-t border-cream-200">
                    {loadingBreakdown === period.id ? (
                      <div className="flex justify-center py-6">
                        <LoadingSpinner label="Loading breakdown…" />
                      </div>
                    ) : bd ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Paid */}
                        <div>
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <CheckCircle2 size={12} /> Paid ({bd.paid.length})
                          </p>
                          {bd.paid.length === 0 ? (
                            <p className="text-xs text-ink-500">
                              No payments yet.
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {bd.paid.map((m) => (
                                <li
                                  key={m.id}
                                  className="flex items-center justify-between text-sm bg-emerald-50 rounded-lg px-3 py-1.5"
                                >
                                  <span className="text-ink-900">{m.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-emerald-700">
                                      {formatMoney(m.amount)}
                                    </span>
                                    {m.status === "pending" && (
                                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                        pending
                                      </span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Unpaid */}
                        <div>
                          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <XCircle size={12} /> Not Paid ({bd.unpaid.length})
                          </p>
                          {bd.unpaid.length === 0 ? (
                            <p className="text-xs text-emerald-700 font-medium">
                              All members have paid! 🎉
                            </p>
                          ) : (
                            <ul className="space-y-1.5">
                              {bd.unpaid.map((m) => (
                                <li
                                  key={m.id}
                                  className="flex items-center text-sm bg-rose-50 rounded-lg px-3 py-1.5"
                                >
                                  <span className="text-ink-700">{m.name}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create period modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Monthly Period" : "Create Monthly Period"}
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              form="period-form"
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving
                ? editing
                  ? "Saving…"
                  : "Creating…"
                : editing
                  ? "Save Changes"
                  : "Create"}
            </button>
          </>
        }
      >
        <form id="period-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Month</label>
              <select
                className="input"
                value={form.month}
                onChange={(e) =>
                  setForm((f) => ({ ...f, month: e.target.value }))
                }
              >
                {MONTHS.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input
                type="number"
                className="input"
                value={form.year}
                onChange={(e) =>
                  setForm((f) => ({ ...f, year: e.target.value }))
                }
                min={2020}
                max={2100}
              />
            </div>
          </div>
          <div>
            <label className="label">Target per member (KSh)</label>
            <input
              type="number"
              className="input"
              value={form.target_amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, target_amount: e.target.value }))
              }
              min={0}
            />
          </div>
          <div>
            <label className="label">
              Notes <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="e.g. Includes Christmas levy"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
