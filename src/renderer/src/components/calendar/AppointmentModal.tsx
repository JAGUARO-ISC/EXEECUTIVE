import React, { useEffect, useState } from 'react';
import { Modal, TextInput, Textarea, Select, Group, Button, Stack, ColorInput, Switch, NumberInput, Alert } from '@mantine/core';
import { DateTimePicker, DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAppointmentStore } from '../../stores';
import { ConfirmButton } from '../common/ConfirmButton';
import type { Appointment } from '../../types';

interface Props {
  opened: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  /** Default start for a new appointment. */
  date: Date;
}

const priorityOptions = [
  { value: '0', label: 'Bassa' },
  { value: '1', label: 'Media' },
  { value: '2', label: 'Alta' },
  { value: '3', label: 'Urgente' },
];
const categoryOptions = [['meeting','Riunione'],['call','Chiamata'],['personal','Personale'],['work','Lavoro'],['other','Altro']].map(([value,label]) => ({ value, label }));
const recurrenceOptions = [['daily','Ogni giorno'],['weekly','Ogni settimana'],['monthly','Ogni mese'],['yearly','Ogni anno']].map(([value,label]) => ({ value, label }));

interface FormValues {
  title: string;
  description: string;
  startDatetime: Date;
  endDatetime: Date;
  location: string;
  category: string;
  color: string;
  priority: string;
  reminderMinutes: number;
  isRecurring: boolean;
  recurrencePattern: string;
  recurrenceEnd: Date | null;
}

const defaults = (start: Date): FormValues => ({
  title: '',
  description: '',
  startDatetime: start,
  endDatetime: new Date(start.getTime() + 3600000),
  location: '',
  category: 'meeting',
  color: '#3b82f6',
  priority: '1',
  reminderMinutes: 10,
  isRecurring: false,
  recurrencePattern: 'weekly',
  recurrenceEnd: null,
});

export const AppointmentModal: React.FC<Props> = ({ opened, onClose, appointment, date }) => {
  const { addAppointment, updateAppointment, deleteAppointment } = useAppointmentStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    initialValues: defaults(date),
    validate: {
      title: (v) => (v.trim() === '' ? 'Il titolo è obbligatorio' : null),
      endDatetime: (v, values) => (v <= values.startDatetime ? "La fine deve essere dopo l'inizio" : null),
    },
  });

  useEffect(() => {
    if (!opened) return;
    setError(null);
    if (appointment) {
      form.setValues({
        title: appointment.title,
        description: appointment.description ?? '',
        startDatetime: new Date(appointment.startDatetime),
        endDatetime: new Date(appointment.endDatetime),
        location: appointment.location ?? '',
        category: appointment.category ?? 'meeting',
        color: appointment.color ?? '#3B82F6',
        priority: String(appointment.priority),
        reminderMinutes: appointment.reminderMinutes,
        isRecurring: appointment.isRecurring,
        recurrencePattern: appointment.recurrencePattern ?? 'weekly',
        recurrenceEnd: appointment.recurrenceEnd ? new Date(appointment.recurrenceEnd) : null,
      });
    } else {
      form.setValues(defaults(date));
    }
    form.resetDirty();
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, appointment, date]);

  const submit = async (v: FormValues) => {
    const payload: Omit<Appointment, 'id'> = {
      title: v.title.trim(),
      description: v.description || null,
      startDatetime: v.startDatetime.toISOString(),
      endDatetime: v.endDatetime.toISOString(),
      location: v.location || null,
      category: v.category,
      color: v.color,
      priority: parseInt(v.priority, 10),
      reminderMinutes: Number(v.reminderMinutes) || 0,
      isRecurring: v.isRecurring,
      recurrencePattern: v.isRecurring ? v.recurrencePattern : null,
      recurrenceEnd: v.isRecurring && v.recurrenceEnd ? new Date(v.recurrenceEnd.getFullYear(), v.recurrenceEnd.getMonth(), v.recurrenceEnd.getDate(), 23, 59, 59).toISOString() : null,
    };
    setSaving(true);
    setError(null);
    const ok = appointment?.id ? await updateAppointment(appointment.id, payload) : await addAppointment(payload);
    setSaving(false);
    if (ok) {
      notifications.show({ message: appointment?.id ? 'Appuntamento aggiornato' : 'Appuntamento creato', color: 'green' });
      onClose();
    } else {
      setError(useAppointmentStore.getState().error ?? 'Salvataggio non riuscito');
    }
  };

  const remove = async () => {
    if (!appointment?.id) return;
    setSaving(true);
    const ok = await deleteAppointment(appointment.id);
    setSaving(false);
    if (ok) {
      notifications.show({ message: 'Appuntamento eliminato', color: 'gray' });
      onClose();
    } else {
      setError(useAppointmentStore.getState().error ?? 'Eliminazione non riuscita');
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={appointment ? 'Modifica appuntamento' : 'Nuovo appuntamento'} size="lg">
      <form onSubmit={form.onSubmit(submit)}>
        <Stack gap="md">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput label="Titolo" placeholder="Riunione con cliente" data-autofocus {...form.getInputProps('title')} />
          <Textarea label="Descrizione" rows={3} {...form.getInputProps('description')} />
          <Group grow align="flex-start">
            <DateTimePicker label="Inizio" valueFormat="DD MMM YYYY HH:mm" {...form.getInputProps('startDatetime')} />
            <DateTimePicker label="Fine" valueFormat="DD MMM YYYY HH:mm" {...form.getInputProps('endDatetime')} />
          </Group>
          <TextInput label="Luogo" {...form.getInputProps('location')} />
          <Group grow>
            <Select label="Categoria" data={categoryOptions} allowDeselect={false} {...form.getInputProps('category')} />
            <Select label="Priorità" data={priorityOptions} allowDeselect={false} {...form.getInputProps('priority')} />
          </Group>
          <Group grow>
            <ColorInput label="Colore" {...form.getInputProps('color')} />
            <NumberInput label="Promemoria (minuti prima, 0 = nessuno)" min={0} max={10080} {...form.getInputProps('reminderMinutes')} />
          </Group>
          <Switch label="Ricorrente" {...form.getInputProps('isRecurring', { type: 'checkbox' })} />
          {form.values.isRecurring && (
            <Group grow align="flex-start">
              <Select label="Ripeti" data={recurrenceOptions} allowDeselect={false} {...form.getInputProps('recurrencePattern')} />
              <DatePickerInput label="Ripeti fino al (facoltativo)" clearable {...form.getInputProps('recurrenceEnd')} />
            </Group>
          )}
          <Group justify="space-between" mt="md">
            {appointment?.id ? (
              <ConfirmButton onConfirm={remove} disabled={saving} />
            ) : (
              <span />
            )}
            <Group>
              <Button variant="default" onClick={onClose} disabled={saving}>
                Annulla
              </Button>
              <Button type="submit" loading={saving}>
                {appointment ? 'Salva' : 'Crea appuntamento'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default AppointmentModal;
