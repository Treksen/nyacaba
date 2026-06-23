import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNotifyError } from "../../lib/useNotifyError";
import { formatMoney, formatDate } from "../../lib/format";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";

export default function MonthlyDetail() {
  const { id } = useParams();
  const { profile, isStaff } = useAuth();
  const toast = useToast();
  const notifyError = useNotifyError();

  const [period, setPeriod] = useState(null);
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [paid, setPaid] = useState([]);
  const [unpaid, setUnpaid] = useState([]);

  async function load() {
    setLoading(true);

    const [{ data: p }, { data: m }, { data: c }] = await Promise.all([
      supabase.from("monthly_periods").select("*").eq("id", id).maybeSingle(),

      supabase
        .from("members")
        .select("id, full_name, status")
        .eq("status", "active"),

      supabase
        .from("contributions")
        .select(
          "id, member_id, amount, contribution_date, verification_status, members(full_name)",
        )
        .eq("period_id", id)
        .eq("contribution_type", "monthly"),
    ]);

    if (!p) {
      setPeriod(null);
      setLoading(false);
      return;
    }

    setPeriod(p);
    setMembers(m || []);
    setContributions(c || []);

    const paidMap = new Map();

    (c || []).forEach((x) => {
      paidMap.set(x.member_id, {
        id: x.member_id,
        name: x.members?.full_name || "Unknown",
        amount: Number(x.amount || 0),
        status: x.verification_status,
        date: x.contribution_date,
      });
    });

    const paidList = Array.from(paidMap.values());

    const unpaidList = (m || [])
      .filter((mem) => !paidMap.has(mem.id))
      .map((mem) => ({
        id: mem.id,
        name: mem.full_name,
      }));

    setPaid(paidList);
    setUnpaid(unpaidList);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  if (!isStaff) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Leadership only"
        description="Only leadership can view monthly contribution details."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner label="Loading month..." />
      </div>
    );
  }

  if (!period) {
    return <EmptyState title="Month not found" />;
  }

  const totalCollected = paid.reduce((s, p) => s + p.amount, 0);
  const target = (period.target_amount || 0) * members.length;
  const pct =
    target > 0 ? Math.min(100, Math.round((totalCollected / target) * 100)) : 0;

  return (
    <div className="space-y-5">
      
      <Link
        to="/projects?tab=monthly"
        className="text-sm text-primary-900 hover:text-primary-700 inline-flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Back to Monthly Contributions
      </Link>
      {/* Header */}
      <div className="card-padded paper-grain">
        <h1 className="font-display text-3xl font-semibold">
          {period.month} / {period.year} Monthly Contributions
        </h1>

        {period.notes && <p className="text-ink-600 mt-2">{period.notes}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Active Members</p>
            <p className="font-display text-xl font-semibold">
              {members.length}
            </p>
          </div>

          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Paid</p>
            <p className="font-display text-xl font-semibold text-emerald-700">
              {paid.length}
            </p>
          </div>

          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Unpaid</p>
            <p className="font-display text-xl font-semibold text-rose-700">
              {unpaid.length}
            </p>
          </div>

          <div className="bg-cream-100 rounded-xl p-3">
            <p className="kicker">Collected</p>
            <p className="font-display text-xl font-semibold text-primary-900">
              {formatMoney(totalCollected)}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span className="font-semibold text-primary-900">{pct}%</span>
          </div>

          <div className="h-3 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-900"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="text-xs text-ink-500 mt-2 flex justify-between">
            <span>{formatMoney(totalCollected)} collected</span>
            <span>Target: {formatMoney(target)}</span>
          </div>
        </div>
      </div>
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PAID */}
        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-3 text-emerald-700">
            <CheckCircle2 size={18} /> Paid Members ({paid.length})
          </h3>

          {paid.length === 0 ? (
            <p className="text-sm text-ink-600">No payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {paid.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between bg-emerald-50 px-3 py-2 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-ink-500">
                      {p.date && formatDate(p.date)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-emerald-700">
                      {formatMoney(p.amount)}
                    </p>
                    {p.status === "pending" && (
                      <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        pending
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* UNPAID */}
        <div className="card-padded">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-3 text-rose-700">
            <XCircle size={18} /> Unpaid Members ({unpaid.length})
          </h3>

          {unpaid.length === 0 ? (
            <p className="text-emerald-700 font-medium">
              🎉 All members have paid!
            </p>
          ) : (
            <ul className="space-y-2">
              {unpaid.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between bg-rose-50 px-3 py-2 rounded-lg"
                >
                  <p className="text-sm text-ink-800">{m.name}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
