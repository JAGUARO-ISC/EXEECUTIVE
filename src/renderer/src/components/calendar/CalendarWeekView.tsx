import React from 'react';
import type { Appointment } from '../../types';
import { addDays, startOfWeek } from '../../utils/date';
import { TimeGrid } from './TimeGrid';

interface Props {
  date: Date;
  appointments: Appointment[];
  onDateChange: (date: Date) => void;
  onAddAppointment: (day?: Date) => void;
  onEditAppointment: (appointment: Appointment) => void;
}

export const CalendarWeekView: React.FC<Props> = ({ date, appointments, onAddAppointment, onEditAppointment }) => {
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return <TimeGrid days={days} appointments={appointments} onAddAppointment={onAddAppointment} onEditAppointment={onEditAppointment} />;
};

export default CalendarWeekView;
