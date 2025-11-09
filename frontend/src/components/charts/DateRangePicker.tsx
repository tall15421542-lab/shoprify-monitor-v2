import { Calendar } from 'lucide-react';
import type { DateRange } from '../../types';

interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (dateRange: DateRange) => void;
}

function DateRangePicker({ dateRange, onChange }: DateRangePickerProps) {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = new Date(e.target.value);
    onChange({ ...dateRange, startDate: newStartDate });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = new Date(e.target.value);
    onChange({ ...dateRange, endDate: newEndDate });
  };

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ];

  const handlePresetClick = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    onChange({ startDate, endDate });
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="text-primary-600" size={20} />
        <h3 className="font-semibold text-gray-900">Date Range</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="label">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={formatDateForInput(dateRange.startDate)}
              onChange={handleStartDateChange}
              max={formatDateForInput(dateRange.endDate)}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="label">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={formatDateForInput(dateRange.endDate)}
              onChange={handleEndDateChange}
              min={formatDateForInput(dateRange.startDate)}
              max={formatDateForInput(new Date())}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">Quick select:</p>
          <div className="flex gap-2">
            {presets.map((preset) => (
              <button
                key={preset.days}
                onClick={() => handlePresetClick(preset.days)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DateRangePicker;

