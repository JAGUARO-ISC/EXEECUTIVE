import React from 'react';
import type { Appointment } from '../../types';
import { startOfDay } from '../../utils/date';
import { TimeGrid } from './TimeGrid';

interface Props {
  date: Date;
  appointments: Appointment[];
  onDateChange: (date: Date) => void;
  onAddAppointment: (day?: Date) => void;
  onEditAppointment: (appointment: Appointment) => void;
}

export const CalendarDayView: React.FC<Props> = ({ date, appointments, onAddAppointment, onEditAppointment }) => (
  <TimeGrid days={[startOfDay(date)]} appointments={appointments} onAddAppointment={onAddAppointment} onEditAppointment={onEditAppointment} />
);

export default CalendarDayView;
