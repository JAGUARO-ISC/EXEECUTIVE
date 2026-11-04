import React, { useState } from 'react';
import { Popover, Button, Stack, Paper, Group, Text, Badge, rem, useMantineTheme, ActionIcon } from '@mantine/core';
import { IconBell, IconX, IconCheck, IconClock, IconCalendar, IconAlertCircle } from '@tabler/icons-react';

// Mock notifications
const mockNotifications = [
  { id: 1, title: 'Meeting with Client', message: 'Your meeting with John Doe starts in 15 minutes', type: 'appointment', time: '5:45 PM', read: false },
  { id: 2, title: 'Task Due Soon', message: 'Complete project proposal is due tomorrow', type: 'task', time: 'Yesterday', read: false },
  { id: 3, title: 'Payment Received', message: '€1,500 received from Acme Corp', type: 'transaction', time: '2:30 PM', read: true },
  { id: 4, title: 'Backup Created', message: 'Daily backup completed successfully', type: 'system', time: '1:00 PM', read: true },
];

export const NotificationCenter: React.FC = () => {
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'appointment':
        return <IconCalendar size={16} color={theme.colors.blue[6]} />;
      case 'task':
        return <IconClock size={16} color={theme.colors.orange[6]} />;
      case 'transaction':
        return <IconAlertCircle size={16} color={theme.colors.green[6]} />;
      case 'system':
        return <IconAlertCircle size={16} color={theme.colors.gray[6]} />;
      default:
        return <IconBell size={16} />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'appointment':
        return 'blue';
      case 'task':
        return 'orange';
      case 'transaction':
        return 'green';
      case 'system':
        return 'gray';
      default:
        return 'gray';
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={350}
      shadow="lg"
      withinPortal
    >
      <Popover.Target>
        <Button
          variant="subtle"
          size="compact-md"
          onClick={() => setOpened((o) => !o)}
          leftSection={<IconBell size={18} />}
          rightSection={unreadCount > 0 && (
            <Badge
              variant="filled"
              color="red"
              size="xs"
              style={{
                borderRadius: '50%',
                padding: '0 4px',
                minWidth: rem(18),
                height: rem(18),
              }}
            >
              {unreadCount}
            </Badge>
          )}
        >
          Notifications
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Group justify="space-between" align="center" p="xs">
            <Text size="sm" fw={600}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={markAllAsRead}
              >
                Mark all as read
              </Button>
            )}
          </Group>

          <Divider />

          <ScrollArea h={300}>
            <Stack gap="xs">
              {notifications.map((notification) => (
                <Paper
                  key={notification.id}
                  withBorder
                  radius="sm"
                  p="sm"
                  onClick={() => markAsRead(notification.id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: notification.read
                      ? 'transparent'
                      : theme.colorScheme === 'dark'
                        ? theme.colors.dark[7]
                        : theme.colors.gray[0],
                    borderLeft: `4px solid ${theme.colors[getColor(notification.type)][6]}`,
                  }}
                >
                  <Group gap="sm" align="flex-start">
                    {getIcon(notification.type)}
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {notification.title}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {notification.message}
                      </Text>
                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          {notification.time}
                        </Text>
                        {!notification.read && (
                          <Badge
                            variant="filled"
                            color="blue"
                            size="xs"
                            style={{
                              borderRadius: '50%',
                              width: rem(8),
                              height: rem(8),
                              padding: 0,
                            }}
                          />
                        )}
                      </Group>
                    </Stack>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Delete notification
                        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
                      }}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </ScrollArea>

          <Divider />

          <Group justify="space-between" p="xs">
            <Button
              variant="subtle"
              size="compact-xs"
              onClick={clearAll}
              color="red"
            >
              Clear all
            </Button>
            <Button
              variant="subtle"
              size="compact-xs"
              onClick={() => setOpened(false)}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

// ScrollArea component for notifications
const ScrollArea = ({ h, children }: { h: number; children: React.ReactNode }) => (
  <div style={{ height: h, overflowY: 'auto' }}>
    {children}
  </div>
);

export default NotificationCenter;
