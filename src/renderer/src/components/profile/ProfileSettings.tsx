import React, { useState } from 'react';
import { PageHead, Panel } from '../common/ui';
import { useProfileStore } from '../../stores/profile';

export const ProfileSettings: React.FC = () => {
  const profile = useProfileStore();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  return <main className="page narrow profile-page">
    <PageHead title="Profilo" sub="Identità, nome e presenza in EXEECUTIVE" />
    <Panel title="La tua identità" sub="Queste informazioni restano sul dispositivo">
      <div className="profile-settings">
        <div className="profile-avatar large">{profile.initials()}</div>
        <div className="profile-fields">
          <label className="field"><span>Nome</span><input className="input" aria-label="Nome" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value.slice(0, 60))} placeholder="Nome" /></label>
          <label className="field"><span>Cognome</span><input className="input" aria-label="Cognome" value={lastName} onChange={(e) => setLastName(e.currentTarget.value.slice(0, 60))} placeholder="Cognome" /></label>
          <button className="primary-btn" onClick={() => profile.update({ firstName: firstName.trim(), lastName: lastName.trim() })}>Salva modifiche</button>
        </div>
      </div>
    </Panel>
  </main>;
};
