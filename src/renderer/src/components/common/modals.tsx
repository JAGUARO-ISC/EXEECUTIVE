import React, { useRef, useState } from 'react';
import { Alert, Button, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Switch, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useGoalStore, useNoteStore, useTaskStore, useTxStore } from '../../stores';
import { useSettings } from '../../stores/settings';
import { useUi, type ModalState } from '../../stores/ui';
import { dateKey } from '../../utils/date';
import { CURRENCIES, convertMinor, currencyInfo, formatMoney, minorToInput, parseMinor } from '../../utils/currency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, NOTE_CATEGORIES, PAYMENT_METHODS, TASK_CATEGORIES } from '../../utils/categories';
import { useCat, useT } from '../../i18n';
import type { Goal, Note, Task, Transaction, TxKind } from '../../types';
import { ConfirmButton } from './ConfirmButton';
import { AppointmentModal } from '../calendar/AppointmentModal';

const toDate = (s?: string | null): Date | null => (s ? new Date(`${s}T00:00:00`) : null);
const fromDate = (d: Date | null): string | null => (d ? dateKey(d) : null);
/** Sentinel for the free-text category choice. Never stored. */
const OTHER = '__other__';

const OtherDetailField: React.FC<{
  value: string;
  error?: string;
  onChange: (value: string) => void;
}> = ({ value, error, onChange }) => {
  const { t } = useT();
  return (
    <TextInput
      label={t('fin.otherCat')}
      placeholder={t('fin.otherCatPh')}
      value={value}
      error={error}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
};

const useOpts = () => {
  const { t } = useT();
  const cat = useCat();
  return {
    cats: (a: string[]) => a.map((v) => ({ value: v, label: cat(v) })),
    pay: PAYMENT_METHODS.map((v) => ({ value: v, label: t(`pay.${v}`) })),
    prio: [0, 1, 2, 3].map((i) => ({ value: String(i), label: t(`prio.${i}`) })),
    status: (['todo', 'doing', 'done'] as const).map((v) => ({ value: v, label: t(`status.${v}`) })),
    currencies: CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })),
  };
};

interface FooterProps {
  saving: boolean;
  editing: boolean;
  submitLabel: string;
  onClose: () => void;
  onDelete?: () => void;
}

const Footer: React.FC<FooterProps> = ({ saving, editing, submitLabel, onClose, onDelete }) => {
  const { t } = useT();
  return (
    <Group justify="space-between" mt="md">
      {editing && onDelete ? <ConfirmButton disabled={saving} onConfirm={onDelete} /> : <span />}
      <Group>
        <Button variant="default" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </Group>
    </Group>
  );
};

/** Runs a store mutation and handles toast / error / close. */
function useSubmit(onClose: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<string | null>, okMsg: string) => {
    setSaving(true);
    setError(null);
    const err = await fn();
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    notifications.show({ message: okMsg, color: 'green' });
    onClose();
  };
  return { saving, error, setError, run };
}

// ---------------------------------------------------------------- task

const TaskModal: React.FC<{ task: Task | null; onClose: () => void }> = ({ task, onClose }) => {
  const { t } = useT();
  const o = useOpts();
  const { add, update, remove } = useTaskStore();
  const { saving, error, setError, run } = useSubmit(onClose);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [due, setDue] = useState<Date | null>(toDate(task?.dueDate));
  const [time, setTime] = useState(task?.dueTime ?? '');
  const [priority, setPriority] = useState(String(task?.priority ?? 1));
  const [status, setStatus] = useState<string>(task?.status ?? 'todo');
  const [category, setCategory] = useState<string | null>(task?.category ?? 'Lavoro');
  const [custom, setCustom] = useState(category === 'Altro' ? task?.description ?? '' : '');
  const [reminder, setReminder] = useState<number | string>(task?.reminderMinutes ?? 0);
  const [titleErr, setTitleErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setTitleErr(t('common.titleRequired'));
    if (Number(reminder) > 0 && !due) return setError(t('task.needDue'));
    const v: Omit<Task, 'id'> = {
      title: title.trim(),
      description: description || (category === 'Altro' && custom.trim() ? custom.trim() : null),
      dueDate: fromDate(due),
      dueTime: time || null,
      priority: Number(priority),
      status: status as Task['status'],
      category,
      reminderMinutes: Number(reminder) || 0,
    };
    void run(() => (task?.id ? update(task.id, v) : add(v)), task?.id ? t('task.updated') : t('task.created'));
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        {error && <Alert color="red">{error}</Alert>}
        <TextInput label={t('common.title')} data-autofocus value={title} error={titleErr} onChange={(e) => { setTitle(e.currentTarget.value); setTitleErr(null); }} />
        <Textarea label={t('common.description')} rows={3} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Group grow align="flex-start">
          <DatePickerInput label={t('task.due')} clearable valueFormat="DD MMM YYYY" value={due} onChange={setDue} />
          <TextInput label={t('common.time')} type="time" value={time} onChange={(e) => setTime(e.currentTarget.value)} />
        </Group>
        <Group grow>
          <Select label={t('common.priority')} allowDeselect={false} data={o.prio} value={priority} onChange={(v) => setPriority(v ?? '1')} />
          <Select label={t('common.status')} allowDeselect={false} data={o.status} value={status} onChange={(v) => setStatus(v ?? 'todo')} />
        </Group>
        <Group grow>
          <Select label={t('common.category')} data={o.cats(TASK_CATEGORIES)} value={category} onChange={(next) => { setCategory(next); if (next !== 'Altro') setCustom(''); }} />
          <NumberInput label={t('task.reminder')} min={0} max={10080} value={reminder} onChange={setReminder} />
        </Group>
        {category === 'Altro' && <OtherDetailField value={custom} onChange={setCustom} />}
        <Footer saving={saving} editing={!!task?.id} submitLabel={task?.id ? t('common.save') : t('task.create')} onClose={onClose} onDelete={() => void run(() => remove(task!.id!), t('task.deleted'))} />
      </Stack>
    </form>
  );
};

// --------------------------------------------------------- transaction

const TransactionModal: React.FC<{ kind: TxKind; transaction: Transaction | null; onClose: () => void }> = ({ kind: initialKind, transaction, onClose }) => {
  const { t, locale } = useT();
  const o = useOpts();
  const cat = useCat();
  const { add, update, remove } = useTxStore();
  const defaultCurrency = useSettings((s) => s.currency);
  const rates = useSettings((s) => s.rates);
  const { saving, error, run } = useSubmit(onClose);

  const startKind = transaction?.kind ?? initialKind;
  const known = (k: TxKind) => (k === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
  // An edited transaction may carry a custom category that is not in the list.
  const startCat = transaction?.category;
  const isCustom = !!startCat && !known(startKind).includes(startCat);

  const [kind, setKind] = useState<TxKind>(startKind);
  const [currency, setCurrency] = useState<string>(transaction?.currency ?? defaultCurrency);
  const [amount, setAmount] = useState(transaction ? minorToInput(transaction.amountCents, transaction.currency, locale) : '');
  const [category, setCategory] = useState<string | null>(isCustom ? OTHER : startCat ?? known(startKind)[0]);
  const [custom, setCustom] = useState(isCustom ? startCat! : '');
  const [counterparty, setCounterparty] = useState(transaction?.counterparty ?? '');
  const [method, setMethod] = useState<string | null>(transaction?.paymentMethod ?? 'Carta');
  const [date, setDate] = useState<Date | null>(toDate(transaction?.date) ?? new Date());
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [errs, setErrs] = useState<{ amount?: string; category?: string; custom?: string; date?: string }>({});

  const changeKind = (k: string) => {
    setKind(k as TxKind);
    setCategory(known(k as TxKind)[0]);
    setCustom('');
  };

  // The "Altro" choice (and the free-text one) reveals a field to say what it was.
  const needsCustom = category === OTHER || category === 'Altro' || category === 'Altre entrate';
  const parsed = parseMinor(amount, currency);
  const preview = parsed !== null && currency !== defaultCurrency ? convertMinor(parsed, currency, defaultCurrency, rates) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errs = {};
    if (parsed === null) next.amount = t('common.amountInvalid');
    if (!category) next.category = t('fin.pickCat');
    if (category === OTHER && !custom.trim()) next.custom = t('fin.otherCatReq');
    if (!date) next.date = t('fin.pickDate');
    setErrs(next);
    if (Object.keys(next).length) return;
    // "Altro" with a description keeps the canonical category and stores the detail in the description when empty.
    const finalCategory = category === OTHER ? custom.trim() : category!;
    const detail = category !== OTHER && needsCustom && custom.trim() ? custom.trim() : null;
    const v: Omit<Transaction, 'id'> = {
      kind,
      amountCents: parsed!,
      currency,
      description: description.trim() || detail,
      category: finalCategory,
      counterparty: counterparty.trim() || null,
      paymentMethod: method,
      date: dateKey(date!),
      notes: notes || null,
    };
    void run(() => (transaction?.id ? update(transaction.id, v) : add(v)), kind === 'income' ? t('fin.incomeSaved') : t('fin.expenseSaved'));
  };

  const catData = [...o.cats(known(kind)), { value: OTHER, label: t('fin.otherCat') }];

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        {error && <Alert color="red">{error}</Alert>}
        <SegmentedControl fullWidth value={kind} onChange={changeKind} data={[{ value: 'expense', label: t('fin.expense') }, { value: 'income', label: t('fin.income') }]} />
        <Group grow align="flex-start" wrap="nowrap">
          <TextInput
            label={t('fin.amount')}
            placeholder={currencyInfo(currency).decimals ? '0,00' : '0'}
            inputMode="decimal"
            data-autofocus
            size="md"
            value={amount}
            error={errs.amount}
            leftSection={<span style={{ fontSize: 13, opacity: 0.8 }}>{currencyInfo(currency).symbol}</span>}
            onChange={(e) => setAmount(e.currentTarget.value)}
            style={{ flex: 2 }}
          />
          <Select label={t('fin.inCurrency')} searchable data={o.currencies} value={currency} onChange={(v) => v && setCurrency(v)} allowDeselect={false} size="md" style={{ flex: 3 }} />
        </Group>
        {currency !== defaultCurrency && parsed !== null && (
          <div className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            {preview !== null ? t('fin.converted', { amount: formatMoney(preview, defaultCurrency, locale) }) : t('fin.noRate')}
          </div>
        )}
        <Group grow align="flex-start">
          <Select label={t('common.category')} searchable data={catData} value={category} error={errs.category} onChange={(v) => { setCategory(v); setErrs((x) => ({ ...x, category: undefined })); }} allowDeselect={false} />
          <Select label={t('fin.method')} data={o.pay} value={method} onChange={setMethod} allowDeselect={false} />
        </Group>
        {needsCustom && (
          <OtherDetailField
            value={custom}
            error={errs.custom}
            onChange={(value) => { setCustom(value); setErrs((x) => ({ ...x, custom: undefined })); }}
          />
        )}
        <TextInput
          label={kind === 'income' ? t('fin.fromWhom') : t('fin.toWhom')}
          placeholder={kind === 'income' ? t('fin.fromPh') : t('fin.toPh')}
          value={counterparty}
          onChange={(e) => setCounterparty(e.currentTarget.value)}
        />
        <Group grow align="flex-start">
          <DatePickerInput label={t('common.date')} valueFormat="DD MMM YYYY" value={date} error={errs.date} onChange={setDate} />
          <TextInput label={t('common.description')} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        </Group>
        <Textarea label={t('common.notes')} rows={2} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Footer
          saving={saving}
          editing={!!transaction?.id}
          submitLabel={transaction?.id ? t('common.save') : kind === 'income' ? t('fin.registerIncome') : t('fin.registerExpense')}
          onClose={onClose}
          onDelete={() => void run(() => remove(transaction!.id!), t('fin.deleted'))}
        />
      </Stack>
      <span hidden>{cat('Altro')}</span>
    </form>
  );
};

// ---------------------------------------------------------------- note

const NoteModal: React.FC<{ note: Note | null; onClose: () => void }> = ({ note, onClose }) => {
  const { t } = useT();
  const o = useOpts();
  const { add, update, remove } = useNoteStore();
  const { saving, error, run } = useSubmit(onClose);
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [category, setCategory] = useState<string | null>(note?.category ?? 'Idee');
  const [custom, setCustom] = useState(category === 'Altro' ? note?.content ?? '' : '');
  const [linked, setLinked] = useState<Date | null>(toDate(note?.linkedDate));
  const [important, setImportant] = useState(note?.important ?? false);
  const [titleErr, setTitleErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setTitleErr(t('common.titleRequired'));
    const v: Omit<Note, 'id'> = { title: title.trim(), content: content || (category === 'Altro' && custom.trim() ? custom.trim() : null), category, linkedDate: fromDate(linked), important };
    void run(() => (note?.id ? update(note.id, v) : add(v)), note?.id ? t('note.updated') : t('note.created'));
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        {error && <Alert color="red">{error}</Alert>}
        <TextInput label={t('common.title')} data-autofocus value={title} error={titleErr} onChange={(e) => { setTitle(e.currentTarget.value); setTitleErr(null); }} />
        <Textarea label={t('note.content')} autosize minRows={7} maxRows={14} value={content} onChange={(e) => setContent(e.currentTarget.value)} />
        <Group grow align="flex-start">
          <Select label={t('common.category')} data={o.cats(NOTE_CATEGORIES)} value={category} onChange={(next) => { setCategory(next); if (next !== 'Altro') setCustom(''); }} />
          <DatePickerInput label={t('note.link')} clearable valueFormat="DD MMM YYYY" value={linked} onChange={setLinked} />
        </Group>
        {category === 'Altro' && <OtherDetailField value={custom} onChange={setCustom} />}
        <Switch label={t('note.isImportant')} checked={important} onChange={(e) => setImportant(e.currentTarget.checked)} />
        <Footer saving={saving} editing={!!note?.id} submitLabel={note?.id ? t('common.save') : t('note.create')} onClose={onClose} onDelete={() => void run(() => remove(note!.id!), t('note.deleted'))} />
      </Stack>
    </form>
  );
};

// ---------------------------------------------------------------- goal

const GoalModal: React.FC<{ goal: Goal | null; onClose: () => void }> = ({ goal, onClose }) => {
  const { t, locale } = useT();
  const o = useOpts();
  const { add, update, remove } = useGoalStore();
  const defaultCurrency = useSettings((s) => s.currency);
  const { saving, error, run } = useSubmit(onClose);
  const [title, setTitle] = useState(goal?.title ?? '');
  const [currency, setCurrency] = useState(goal?.currency ?? defaultCurrency);
  const [target, setTarget] = useState(goal ? minorToInput(goal.targetCents, goal.currency, locale) : '');
  const [current, setCurrent] = useState(goal ? minorToInput(goal.currentCents, goal.currency, locale) : '0');
  const [deadline, setDeadline] = useState<Date | null>(toDate(goal?.deadline));
  const [errs, setErrs] = useState<{ title?: string; target?: string; current?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const tg = parseMinor(target, currency);
    const zero = current.trim() === '' || /^0+([.,]0+)?$/.test(current.trim());
    const cur = zero ? 0 : parseMinor(current, currency);
    const next: typeof errs = {};
    if (!title.trim()) next.title = t('common.titleRequired');
    if (tg === null) next.target = t('common.amountInvalid');
    if (cur === null) next.current = t('common.amountInvalid');
    setErrs(next);
    if (Object.keys(next).length) return;
    const v: Omit<Goal, 'id'> = { title: title.trim(), targetCents: tg!, currentCents: cur!, currency, deadline: fromDate(deadline) };
    void run(() => (goal?.id ? update(goal.id, v) : add(v)), goal?.id ? t('goal.updated') : t('goal.created'));
  };

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        {error && <Alert color="red">{error}</Alert>}
        <TextInput label={t('goal.name')} placeholder={t('goal.namePh')} data-autofocus value={title} error={errs.title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Select label={t('fin.currency')} searchable data={o.currencies} value={currency} onChange={(v) => v && setCurrency(v)} allowDeselect={false} />
        <Group grow align="flex-start">
          <TextInput label={t('goal.target')} value={target} error={errs.target} onChange={(e) => setTarget(e.currentTarget.value)} />
          <TextInput label={t('goal.current')} value={current} error={errs.current} onChange={(e) => setCurrent(e.currentTarget.value)} />
        </Group>
        <DatePickerInput label={t('goal.deadline')} clearable valueFormat="DD MMM YYYY" value={deadline} onChange={setDeadline} />
        <Footer saving={saving} editing={!!goal?.id} submitLabel={goal?.id ? t('common.save') : t('goal.create')} onClose={onClose} onDelete={() => void run(() => remove(goal!.id!), t('goal.deleted'))} />
      </Stack>
    </form>
  );
};

// ---------------------------------------------------------------- host

const TITLE_KEYS: Record<string, [string, string]> = {
  task: ['task.new', 'task.edit'],
  transaction: ['fin.newTx', 'fin.editTx'],
  note: ['note.new', 'note.edit'],
  goal: ['goal.new', 'goal.edit'],
};

/**
 * Single place where every create/edit modal is mounted. The last modal stays rendered
 * while Mantine plays the exit transition; a new open remounts it (modalId) with fresh state.
 */
export const ModalHost: React.FC = () => {
  const { t } = useT();
  const modal = useUi((s) => s.modal);
  const id = useUi((s) => s.modalId);
  const close = useUi((s) => s.close);
  const last = useRef<{ m: Exclude<ModalState, null>; id: number } | null>(null);
  if (modal) last.current = { m: modal, id };
  const snap = last.current;
  if (!snap) return null;
  const opened = modal !== null;
  const m = snap.m;

  if (m.type === 'appointment') {
    return <AppointmentModal key={snap.id} opened={opened} onClose={close} appointment={m.appointment} date={m.date} />;
  }
  const editing = (m.type === 'task' && m.task) || (m.type === 'transaction' && m.transaction) || (m.type === 'note' && m.note) || (m.type === 'goal' && m.goal);
  return (
    <Modal opened={opened} onClose={close} title={t(TITLE_KEYS[m.type][editing ? 1 : 0])} size="lg">
      {m.type === 'task' && <TaskModal key={snap.id} task={m.task} onClose={close} />}
      {m.type === 'transaction' && <TransactionModal key={snap.id} kind={m.kind} transaction={m.transaction} onClose={close} />}
      {m.type === 'note' && <NoteModal key={snap.id} note={m.note} onClose={close} />}
      {m.type === 'goal' && <GoalModal key={snap.id} goal={m.goal} onClose={close} />}
    </Modal>
  );
};
