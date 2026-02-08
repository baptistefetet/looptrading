import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface AlertSettings {
  strategies: {
    pullback: boolean;
    breakout: boolean;
    macdCross: boolean;
  };
  minScore: number;
  pushNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string | null;
    end: string | null;
  };
}

interface AlertSettingsResponse {
  data: AlertSettings;
}

const DEFAULT_SETTINGS: AlertSettings = {
  strategies: {
    pullback: true,
    breakout: true,
    macdCross: true,
  },
  minScore: 75,
  pushNotifications: true,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
};

export function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['settings', 'alerts'],
    queryFn: () => api.get<AlertSettingsResponse>('/settings/alerts'),
  });

  useEffect(() => {
    if (settingsQuery.data?.data) {
      setForm(settingsQuery.data.data);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: AlertSettings) =>
      api.put<AlertSettingsResponse>('/settings/alerts', payload),
    onSuccess: (response) => {
      setForm(response.data);
      setSaveMessage('Parametres enregistres.');
      queryClient.invalidateQueries({ queryKey: ['settings', 'alerts'] });
    },
    onError: (error: Error) => {
      setSaveMessage(error.message || 'Impossible de sauvegarder les parametres.');
    },
  });

  const handleSave = () => {
    setSaveMessage(null);
    saveMutation.mutate(form);
  };

  if (settingsQuery.isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Settings &gt; Alerts</h1>
        <p className="mt-2 text-gray-400">Chargement des parametres...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-100">Settings &gt; Alerts</h1>
      <p className="mt-2 text-gray-400">
        Configurez vos preferences de notifications et de strategies.
      </p>

      <div className="mt-8 space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100">Strategies</h2>
          <p className="mt-1 text-sm text-gray-500">
            Activez uniquement les strategies qui vous interessent.
          </p>

          <div className="mt-4 space-y-3">
            <ToggleRow
              label="Pullback"
              value={form.strategies.pullback}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  strategies: { ...prev.strategies, pullback: value },
                }))
              }
            />
            <ToggleRow
              label="Breakout"
              value={form.strategies.breakout}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  strategies: { ...prev.strategies, breakout: value },
                }))
              }
            />
            <ToggleRow
              label="MACD Cross"
              value={form.strategies.macdCross}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  strategies: { ...prev.strategies, macdCross: value },
                }))
              }
            />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100">Seuil de score</h2>
          <p className="mt-1 text-sm text-gray-500">Alerte declenchee uniquement si score &gt;= seuil.</p>

          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={100}
              value={form.minScore}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  minScore: Number(event.target.value),
                }))
              }
              className="w-full"
            />
            <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
              <span>0</span>
              <span className="font-semibold text-neon-green">{form.minScore}</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100">Notifications</h2>
          <p className="mt-1 text-sm text-gray-500">
            Activez ou desactivez les notifications push navigateur.
          </p>

          <div className="mt-4">
            <ToggleRow
              label="Push navigateur"
              value={form.pushNotifications}
              onChange={async (value) => {
                if (
                  value &&
                  typeof window !== 'undefined' &&
                  'Notification' in window &&
                  Notification.permission === 'default'
                ) {
                  await Notification.requestPermission();
                }
                setForm((prev) => ({ ...prev, pushNotifications: value }));
              }}
            />

            <div className="mt-3 text-sm text-gray-500">
              Permission actuelle:
              <span className="ml-2 text-gray-300">
                {typeof window !== 'undefined' && 'Notification' in window
                  ? Notification.permission
                  : 'non supporte'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100">Horaires silencieux</h2>
          <p className="mt-1 text-sm text-gray-500">
            Suspendre l&apos;affichage local des notifications pendant une plage horaire.
          </p>

          <div className="mt-4 space-y-4">
            <ToggleRow
              label="Activer les horaires silencieux"
              value={form.quietHours.enabled}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  quietHours: { ...prev.quietHours, enabled: value },
                }))
              }
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm text-gray-300">
                Debut
                <input
                  type="time"
                  value={form.quietHours.start ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      quietHours: { ...prev.quietHours, start: event.target.value || null },
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-dark-600 bg-dark-900 px-3 py-2 text-gray-100"
                />
              </label>

              <label className="text-sm text-gray-300">
                Fin
                <input
                  type="time"
                  value={form.quietHours.end ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      quietHours: { ...prev.quietHours, end: event.target.value || null },
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-dark-600 bg-dark-900 px-3 py-2 text-gray-100"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>

        {saveMessage && (
          <span className="text-sm text-gray-300">{saveMessage}</span>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void | Promise<void>;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-dark-600 bg-dark-900 px-4 py-3">
      <span className="text-sm text-gray-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? 'bg-neon-green' : 'bg-dark-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
