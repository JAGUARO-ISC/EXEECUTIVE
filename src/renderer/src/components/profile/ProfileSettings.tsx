import React, { useState } from 'react';
import { Panel } from '../common/ui';
import { useProfileStore } from '../../stores/profile';

export const ProfileSettings: React.FC = () => {
  const profile = useProfileStore();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  return <Panel title="Profilo" sub="Personalizza identità e avatar locale">
    <div className="profile-settings">
      <div className="profile-avatar large">{profile.initials()}</div>
      <div className="profile-fields">
        <input className="input" aria-label="Nome" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value.slice(0, 60))} placeholder="Nome" />
        <input className="input" aria-label="Cognome" value={lastName} onChange={(e) => setLastName(e.currentTarget.value.slice(0, 60))} placeholder="Cognome" />
        <button className="primary-btn" onClick={() => profile.update({ firstName: firstName.trim(), lastName: lastName.trim() })}>Salva profilo</button>
      </div>
    </div>
  </Panel>;
};
