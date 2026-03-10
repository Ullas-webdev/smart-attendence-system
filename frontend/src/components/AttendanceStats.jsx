import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';


export function AttendanceCircle({ percentage = 0, size = 'md' }) {

  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));

  const r = size === 'lg' ? 54 : 40;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (safePercentage / 100) * circumference;

  const color =
    safePercentage >= 75
      ? '#16a34a'
      : safePercentage >= 60
      ? '#d97706'
      : '#dc2626';

  const dim = size === 'lg' ? 120 : 88;

  return (
    <div className="relative inline-flex items-center justify-center">

      <svg width={dim} height={dim} className="-rotate-90">

        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />

        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />

      </svg>

      <div className="absolute text-center">
        <span
          className={`font-bold ${
            size === 'lg' ? 'text-2xl' : 'text-base'
          }`}
          style={{ color }}
        >
          {safePercentage}%
        </span>
      </div>

    </div>
  );
}



export function StatCard({ label, value, icon: Icon, color = 'blue', trend }) {

  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="card">

      <div className="flex items-center justify-between mb-3">

        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}
        >
          <Icon className="w-5 h-5" />
        </div>

        {trend !== undefined && (
          <span
            className={`text-xs font-medium flex items-center gap-1 ${
              trend >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}

            {Math.abs(trend)}%
          </span>
        )}

      </div>

      <div className="text-2xl font-bold text-gray-900">
        {value}
      </div>

      <div className="text-sm text-gray-500 mt-1">
        {label}
      </div>

    </div>
  );
}



export function EligibilityBadge({ percentage = 0 }) {

  const safePercentage = Number(percentage) || 0;

  if (safePercentage >= 75) {
    return (
      <span className="inline-flex items-center gap-1 badge-green">
        <CheckCircle className="w-3 h-3" />
        Eligible
      </span>
    );
  }

  if (safePercentage >= 60) {
    return (
      <span className="inline-flex items-center gap-1 badge-yellow">
        <AlertTriangle className="w-3 h-3" />
        At Risk
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 badge-red">
      <XCircle className="w-3 h-3" />
      Ineligible
    </span>
  );
}