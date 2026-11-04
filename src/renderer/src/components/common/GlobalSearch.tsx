import React, { useState, useEffect, useRef } from 'react';
import { Modal, TextInput, Stack, Paper, Group, Text, Badge, rem, useMantineTheme, ScrollArea } from '@mantine/core';
import { IconSearch, IconX, IconCalendar, IconTask, IconCoin, IconNote, IconClock } from '@tabler/icons-react';
import { useAppointmentStore, useTaskStore, useTransactionStore, useNoteStore } from '@stores';

interface GlobalSearchProps {
  opened: boolean;
  onClose: () => void;
}

type SearchResult = {
  id: number;
  title: string;
  type: 'appointment' | 'task' | 'transaction' | 'note';
  date?: string;
  amount?: number;
  category?: string;
  status?: string;
  priority?: number;
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ opened, onClose }) => {
  const theme = useMantineTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const { appointments } = useAppointmentStore();
  const { tasks } = useTaskStore();
  const { transactions } = useTransactionStore();
  const { notes } = useNoteStore();

  useEffect(() => {
    if (opened) {
      setSearchQuery('');
      setResults([]);
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [opened]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const newResults: SearchResult[] = [];

    // Search appointments
    appointments.forEach((a) => {
      if (a.title.toLowerCase().includes(query) || a.description?.toLowerCase().includes(query)) {
        newResults.push({
          id: a.id || 0,
          title: a.title,
          type: 'appointment',
          date: a.startDatetime,
          category: a.category,
        });
      }
    });

    // Search tasks
    tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)) {
        newResults.push({
          id: t.id || 0,
          title: t.title,
          type: 'task',
          date: t.dueDate,
          status: t.status,
          priority: t.priority,
        });
      }
    });

    // Search transactions
    transactions.forEach((t) => {
      if (
        t.description?.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      ) {
        newResults.push({
          id: t.id || 0,
          title: t.description || t.category,
          type: 'transaction',
          date: t.date,
          amount: t.amount,
          category: t.category,
        });
      }
    });

    // Search notes
    notes.forEach((n) => {
      if (n.title.toLowerCase().includes(query) || n.content?.toLowerCase().includes(query)) {
        newResults.push({
          id: n.id || 0,
          title: n.title,
          type: 'note',
          category: n.category,
        });
      }
    });

    setResults(newResults);
    setSelectedIndex(-1);
  }, [searchQuery, appointments, tasks, transactions, notes]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      // Navigate to the selected result
      const result = results[selectedIndex];
      handleResultClick(result);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // In real app, this would navigate to the appropriate page and highlight the item
    console.log('Navigating to:', result);
    onClose();
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'appointment':
        return <IconCalendar size={18} color={theme.colors.blue[6]} />;
      case 'task':
        return <IconTask size={18} color={theme.colors.green[6]} />;
      case 'transaction':
        return <IconCoin size={18} color={theme.colors.purple[6]} />;
      case 'note':
        return <IconNote size={18} color={theme.colors.orange[6]} />;
      default:
        return <IconSearch size={18} />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'appointment':
        return 'Appointment';
      case 'task':
        return 'Task';
      case 'transaction':
        return 'Transaction';
      case 'note':
        return 'Note';
      default:
        return '';
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'appointment':
        return 'blue';
      case 'task':
        return 'green';
      case 'transaction':
        return 'purple';
      case 'note':
        return 'orange';
      default:
        return 'gray';
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Search"
      size="xl"
      centered
      withCloseButton={false}
      onKeyDown={handleKeyDown}
      styles={{
        modal: {
          padding: 0,
        },
        body: {
          padding: 0,
        },
      }}
    >
      <Stack gap={0}>
        <TextInput
          ref={inputRef}
          placeholder="Search appointments, tasks, transactions, and notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={18} />}
          rightSection={
            searchQuery && (
              <IconX
                size={18}
                color={theme.colors.gray[6]}
                style={{ cursor: 'pointer' }}
                onClick={() => setSearchQuery('')}
              />
            )
          }
          size="lg"
          styles={{
            input: {
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottom: 'none',
            },
          }}
          onKeyDown={handleKeyDown}
        />

        {results.length > 0 && (
          <ScrollArea h={400}>
            <Stack gap="xs" p="sm">
              {results.map((result, index) => (
                <Paper
                  key={`${result.type}-${result.id}`}
                  withBorder
                  radius="md"
                  p="sm"
                  onClick={() => handleResultClick(result)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedIndex === index
                      ? theme.colorScheme === 'dark'
                        ? theme.colors.dark[6]
                        : theme.colors.gray[1]
                      : 'transparent',
                    borderLeft: `4px solid ${theme.colors[getTypeColor(result.type)][6]}`,
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseLeave={() => setSelectedIndex(-1)}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="sm" align="center" style={{ flex: 1 }}>
                      {getIcon(result.type)}
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {result.title}
                        </Text>
                        <Group gap="md">
                          <Badge variant="light" color={getTypeColor(result.type)} size="xs">
                            {getTypeLabel(result.type)}
                          </Badge>
                          {result.date && (
                            <Text size="xs" c="dimmed">
                              {new Date(result.date).toLocaleDateString()}
                            </Text>
                          )}
                          {result.amount && (
                            <Text size="xs" fw={500} c={result.type === 'transaction' && result.amount > 0 ? 'green' : 'red'}>
                              €{result.amount.toFixed(2)}
                            </Text>
                          )}
                          {result.status && (
                            <Badge variant="light" color={result.status === 'completed' ? 'green' : result.status === 'in_progress' ? 'blue' : 'gray'} size="xs">
                              {result.status.replace('_', ' ')}
                            </Badge>
                          )}
                        </Group>
                      </Stack>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>
        )}

        {results.length === 0 && searchQuery && (
          <Paper withBorder radius="none" p="xl" ta="center" c="dimmed">
            <Text size="sm">No results found</Text>
            <Text size="xs">Try a different search term</Text>
          </Paper>
        )}

        {results.length === 0 && !searchQuery && (
          <Paper withBorder radius="none" p="xl" ta="center" c="dimmed">
            <IconSearch size={32} color={theme.colors.gray[4]} />
            <Text size="sm" mt="sm">
              Start typing to search
            </Text>
            <Text size="xs">
              Search appointments, tasks, transactions, and notes
            </Text>
          </Paper>
        )}

        <Group justify="flex-end" p="sm">
          <Text size="xs" c="dimmed">
            Press Esc to close
          </Text>
        </Group>
      </Stack>
    </Modal>
  );
};

export default GlobalSearch;
