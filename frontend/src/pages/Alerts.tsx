// Price Alerts page

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import { alertsApi, marketApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

export default function Alerts() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [coinSearch, setCoinSearch] = useState('');
  const [selectedCoin, setSelectedCoin] = useState<{ id: string; symbol: string; name: string } | null>(null);
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [threshold, setThreshold] = useState('');

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: alertsApi.getAlerts,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['search', coinSearch],
    queryFn: () => marketApi.search(coinSearch),
    enabled: coinSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: () => alertsApi.createAlert({
      coin_id: selectedCoin!.id,
      coin_symbol: selectedCoin!.symbol,
      condition,
      threshold: parseFloat(threshold),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setShowForm(false);
      setCoinSearch('');
      setSelectedCoin(null);
      setThreshold('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => alertsApi.deleteAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => alertsApi.toggleAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bell size={22} className="text-brand" /> Price Alerts
          </h1>
          <p className="text-sm text-slate-400 mt-1">Get notified when prices hit your targets</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand hover:bg-brand/90 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Alert
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[#0D1526] border border-[#1E3050] rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-200">Create Alert</h2>

          {/* Coin search */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-[#111E35] border border-[#1E3050] rounded-lg px-3 py-2.5">
              <Search size={14} className="text-slate-500" />
              <input
                value={selectedCoin ? selectedCoin.name : coinSearch}
                onChange={e => { setCoinSearch(e.target.value); setSelectedCoin(null); }}
                placeholder="Search coin..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
            {searchResults && searchResults.length > 0 && !selectedCoin && (
              <div className="absolute top-full mt-1 w-full bg-[#0D1526] border border-[#1E3050] rounded-lg overflow-hidden shadow-xl z-50">
                {searchResults.slice(0, 5).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCoin(c); setCoinSearch(''); }}
                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-white/5 text-left"
                  >
                    <img src={c.thumb} alt={c.name} className="w-5 h-5 rounded-full" />
                    <span className="text-sm text-slate-200">{c.name}</span>
                    <span className="text-xs text-slate-500 uppercase ml-auto">{c.symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Condition</label>
              <div className="flex bg-[#111E35] border border-[#1E3050] rounded-lg overflow-hidden">
                {(['above', 'below'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                      condition === c ? 'bg-brand text-white' : 'text-slate-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Price (USD)</label>
              <input
                type="number"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full bg-[#111E35] border border-[#1E3050] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand font-mono"
              />
            </div>
          </div>

          <button
            onClick={() => createMutation.mutate()}
            disabled={!selectedCoin || !threshold || createMutation.isPending}
            className="w-full bg-brand hover:bg-brand/90 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Alert'}
          </button>
        </div>
      )}

      {/* Alerts list */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 bg-[#0D1526] border border-[#1E3050] rounded-xl animate-pulse" />)}
        </div>
      )}

      {alerts?.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No alerts yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {alerts?.map((alert: {
          id: string;
          coin_symbol: string;
          coin_id: string;
          condition: string;
          threshold: number;
          is_active: boolean;
          triggered_at?: string;
        }) => (
          <div
            key={alert.id}
            className="flex items-center gap-3 bg-[#0D1526] border border-[#1E3050] rounded-xl px-4 py-3"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">
                <span className="uppercase font-bold">{alert.coin_symbol}</span>
                {' '}
                <span className={alert.condition === 'above' ? 'text-green-400' : 'text-red-400'}>
                  {alert.condition}
                </span>
                {' '}
                <span className="font-mono">{formatPrice(alert.threshold)}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {alert.is_active ? (
                  <span className="text-green-400">● Active</span>
                ) : (
                  <span className="text-slate-500">○ Paused</span>
                )}
                {alert.triggered_at && ` · Triggered`}
              </p>
            </div>

            <button
              onClick={() => toggleMutation.mutate(alert.id)}
              className="text-slate-400 hover:text-brand transition-colors"
            >
              {alert.is_active ? <ToggleRight size={22} className="text-brand" /> : <ToggleLeft size={22} />}
            </button>

            <button
              onClick={() => deleteMutation.mutate(alert.id)}
              className="text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Free tier: 2 active alerts max. Upgrade to Pro for unlimited alerts.
      </p>
    </div>
  );
}
