import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Line,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { computeProfileData, computeXTicks, computeAltitudeTicks, computeSpeedTicks } from '../utils/profile.js';

export default function Profile({ flight, segment }) {
  const profileData = React.useMemo(() => {
    return computeProfileData(segment, flight.fixes) || [];
  }, [segment, flight]);

  const xTicks = React.useMemo(() => computeXTicks(profileData), [profileData]);
  const altitudeTicks = React.useMemo(() => computeAltitudeTicks(profileData), [profileData]);
  const speedTicks = React.useMemo(() => computeSpeedTicks(profileData), [profileData]);

  if (!flight?.fixes?.length) {
    return null;
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: 10,
      boxShadow: '0 4px 18px rgba(0,0,0,0.12)',
    }}>
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={profileData} margin={{ top: 20, right: 10, left: 25, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="distance"
            type="number"
            ticks={xTicks}
            domain={[0, 'dataMax']}
            tickFormatter={(v) => `${v.toFixed(0)} km`}
          />

          <YAxis
            yAxisId="left"
            dataKey="altitude"
            domain={['dataMin - 50', 'dataMax + 50']}
            label={{
              value: 'height in m',
              angle: -90,
              position: 'insideLeft',
              fill: '#ff9800',
              style: { textAnchor: 'middle' },
              offset: -10,
            }}
            ticks={altitudeTicks}
            tick={{ fill: '#ff9800' }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            domain={['dataMin - 5', 'dataMax + 5']}
            tick={{ fill: '#2196f3' }}
            ticks={speedTicks}
            label={{
              value: 'speed in km/h',
              angle: 90,
              position: 'insideRight',
              fill: '#2196f3',
              style: { textAnchor: 'middle' },
              padding: 20,
            }}
            tickFormatter={(v) => `${v.toFixed(0)}`}
          />

          <Tooltip
            formatter={(value, name) => {
              if (name === 'altitude') {
                return [`${value.toFixed(0)} m`, 'Altitude'];
              }

              if (name === 'speed') {
                return [`${value.toFixed(1)} km/h`, 'Speed'];
              }

              return value;
            }}
            labelFormatter={(v) => `${v.toFixed(2)} km`}
          />

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="altitude"
            stroke="#ff9800"
            fill="#ffcc80"
            strokeWidth={2}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="speed"
            stroke="#2196f3"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}