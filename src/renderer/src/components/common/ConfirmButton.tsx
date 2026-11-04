import React, { useEffect, useState } from 'react';
import { Button } from '@mantine/core';
import { useT } from '../../i18n';

interface Props {
  label?: string;
  disabled?: boolean;
  onConfirm: () => void;
}

/** Two-step delete: first click arms it, second click confirms. Disarms after 4 seconds. */
export const ConfirmButton: React.FC<Props> = ({ label, disabled, onConfirm }) => {
  const { t } = useT();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      color="red"
      variant={armed ? 'filled' : 'light'}
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? t('common.confirmDelete') : label ?? t('common.delete')}
    </Button>
  );
};
