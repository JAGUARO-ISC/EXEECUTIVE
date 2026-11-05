import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell, Burger, Group, Text, useMantineColorScheme, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCalendar, IconDashboard, IconNotes, IconSettings, IconTask, IconChartBar, IconCash, IconSearch, IconBell } from '@tabler/icons-react';
import { GlobalSearch, NotificationCenter } from '@components/common';
import classes from './MainLayout.module.css';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: IconDashboard },
  { label: 'Calendar', path: '/calendar', icon: IconCalendar },
  { label: 'Tasks', path: '/tasks', icon: IconTask },
  { label: 'Finance', path: '/finance', icon: IconCash },
  { label: 'Statistics', path: '/stats', icon: IconChartBar },
  { label: 'Notes', path: '/notes', icon: IconNotes },
  { label: 'Settings', path: '/settings', icon: IconSettings },
];

export const MainLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [opened, { toggle }] = useDisclosure(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSearch = useCallback(() => {
    setSearchOpened(true);
  }, []);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text size="xl" fw={700} c={isDark ? 'white' : 'dark'}>
              EXEECUTIVE
            </Text>
          </Group>
          <Group gap="sm">
            <Tooltip label="Search (Ctrl+K)" position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={handleSearch}
                radius="md"
              >
                <IconSearch size={18} />
              </ActionIcon>
            </Tooltip>
            <NotificationCenter />
            <Tooltip label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => toggleColorScheme()}
                radius="md"
              >
                <Burger opened={isDark} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={classes.navLink}
              onClick={(e) => {
                e.preventDefault();
              }}
            >
              <item.icon size={20} stroke={1.5} />
              <Text size="sm" ml="md">
                {item.label}
              </Text>
            </a>
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Text size="xs" c="dimmed" ta="center">
            v1.0.0
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {children || <Outlet />}
      </AppShell.Main>

      <GlobalSearch opened={searchOpened} onClose={() => setSearchOpened(false)} />
    </AppShell>
  );
};

export default MainLayout;
