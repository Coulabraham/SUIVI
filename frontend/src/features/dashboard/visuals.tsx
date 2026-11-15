import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardView } from '@suivi/contracts';
import { fcfa } from '../../hooks/business';
import { chartValues } from './chart-values';

const chartColors = ['#0879f9', '#3c94ff', '#72aff7', '#a4caf9', '#d0e2fc', '#295da1'];
export function ProgressRing({ percentage }: { percentage: string }) {
  const value = Math.min(100, Math.max(0, Number(percentage)));
  return (
    <div
      className="progress-ring"
      role="img"
      aria-label={'Progression globale : ' + percentage + ' %'}
      style={{ background: `conic-gradient(#15bc91 ${value}%, #e4edfa ${value}% 100%)` }}
    >
      <div>
        <strong>{percentage.replace('.', ',')} %</strong>
        <span>de l’objectif</span>
      </div>
    </div>
  );
}
function ExactTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: { name?: string; label?: string; totalAmount?: string } }[];
}) {
  const row = payload?.[0]?.payload;
  return active && row?.totalAmount ? (
    <div className="chart-tooltip">
      <span>{row.name ?? row.label}</span>
      <strong>{fcfa(row.totalAmount)}</strong>
    </div>
  ) : null;
}
export function WeeklyChart({ data, admin }: { data: DashboardView; admin: boolean }) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.objective?.timezone ?? 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const weeks = (data.weeklyCollections ?? [])
    .filter((week) => week.startsOn.slice(0, 10) <= today)
    .slice(-6);
  const maximum = weeks.reduce(
    (max, week) => (BigInt(week.totalAmount) > max ? BigInt(week.totalAmount) : max),
    1n,
  );
  const rows = chartValues(weeks).map((week) => ({ ...week, label: 'S' + week.number }));
  const tick = (value: number) => {
    const amount = (maximum * BigInt(Math.round(value * 100))) / 10000n;
    return amount >= 1000000n
      ? (amount / 1000000n).toString() + ' M'
      : amount >= 1000n
        ? (amount / 1000n).toString() + ' k'
        : amount.toString();
  };
  const axes = (
    <>
      <CartesianGrid stroke="#e7effc" vertical={false} />
      <XAxis
        dataKey="label"
        axisLine={false}
        tickLine={false}
        tick={{ fontSize: 11, fill: '#6a86aa' }}
      />
      <YAxis
        domain={[0, 100]}
        tickFormatter={tick}
        axisLine={false}
        tickLine={false}
        width={48}
        tick={{ fontSize: 10, fill: '#6a86aa' }}
      />
      <Tooltip content={ExactTooltip} />
    </>
  );
  return (
    <section className="panel dashboard-chart">
      <div className="section-heading">
        <h2>Évolution des encaissements</h2>
        <span>Par semaine · FCFA</span>
      </div>
      {!rows.length ? (
        <p className="dashboard-empty">Les semaines de collecte n’ont pas encore débuté.</p>
      ) : (
        <div
          className="chart-container"
          role="img"
          aria-label="Encaissements validés par semaine de collecte"
        >
          <ResponsiveContainer width="100%" height="100%">
            {admin ? (
              <AreaChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="collection-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#137cf4" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#137cf4" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                {axes}
                <Area
                  dataKey="value"
                  type="monotone"
                  stroke="#0879f9"
                  strokeWidth={2.5}
                  fill="url(#collection-area)"
                  dot={{ r: 3, fill: '#0879f9', strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <BarChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                {axes}
                <Bar
                  dataKey="value"
                  fill="#1681fa"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <p className="chart-footnote">
        {admin ? 'Toute l’organisation' : 'Votre département'} · jusqu’aux six dernières semaines.
      </p>
      {rows.length > 0 && (
        <details className="chart-details">
          <summary>Voir les montants par semaine</summary>
          <table className="data-table">
            <caption className="sr-only">Encaissements validés en FCFA</caption>
            <thead>
              <tr>
                <th scope="col">Semaine</th>
                <th scope="col">Montant</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>{fcfa(row.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
export function ContributionChart({ data, admin }: { data: DashboardView; admin: boolean }) {
  const source = admin ? data.departments : data.members;
  const sum = source.reduce((total, row) => total + BigInt(row.totalAmount), 0n);
  const other =
    !admin && BigInt(data.departmentTotal) > sum
      ? [
          {
            id: 'others',
            name: 'Autres membres',
            totalAmount: (BigInt(data.departmentTotal) - sum).toString(),
          },
        ]
      : [];
  const total = sum + other.reduce((n, row) => n + BigInt(row.totalAmount), 0n);
  const rows = chartValues(
    [...source, ...other].filter((row) => BigInt(row.totalAmount) > 0n),
    total,
  );
  return (
    <section className="panel dashboard-contributions">
      <div className="section-heading">
        <h2>{admin ? 'Contributions par département' : 'Contributions individuelles'}</h2>
      </div>
      {!rows.length ? (
        <p className="dashboard-empty">Aucune contribution validée pour cette campagne.</p>
      ) : (
        <>
          <div
            className="donut-chart"
            role="img"
            aria-label={
              admin
                ? 'Répartition des contributions par département'
                : 'Répartition des contributions des membres'
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {rows.map((row, index) => (
                    <Cell
                      key={row.id}
                      fill={chartColors[index % chartColors.length] ?? '#0879f9'}
                    />
                  ))}
                </Pie>
                <Tooltip content={ExactTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="chart-legend">
            {rows.map((row, index) => (
              <li key={row.id}>
                <span className="legend-label">
                  <i style={{ background: chartColors[index % chartColors.length] ?? '#0879f9' }} />
                  {row.name}
                </span>
                <strong>{row.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
