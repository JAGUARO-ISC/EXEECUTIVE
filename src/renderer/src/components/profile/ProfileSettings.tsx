import React, { useRef, useState } from 'react';
import { PageHead, Panel } from '../common/ui';
import { useProfileStore } from '../../stores/profile';

export const ProfileSettings: React.FC = () => {
  const profile = useProfileStore();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatar = profile.imageData;
  const choosePhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => profile.update({ imageData: String(reader.result) });
    reader.readAsDataURL(file);
  };
  return <main className="page narrow profile-page">
    <PageHead title="Profilo" sub="Identità, nome e presenza in EXEECUTIVE" />
    <Panel title="La tua identità" sub="Queste informazioni restano sul dispositivo">
      <div className="profile-settings">
        <button className="profile-photo-picker" type="button" onClick={() => fileInput.current?.click()} aria-label="Cambia foto profilo">
          {avatar ? <img src={avatar} alt="Foto profilo" /> : <span className="profile-avatar large">{profile.initials()}</span>}
          <span className="profile-photo-action">Cambia foto</span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => choosePhoto(event.currentTarget.files?.[0])} />
        <div className="profile-fields">
          <label className="field"><span>Nome</span><input className="input" aria-label="Nome" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value.slice(0, 60))} placeholder="Nome" /></label>
          <label className="field"><span>Cognome</span><input className="input" aria-label="Cognome" value={lastName} onChange={(e) => setLastName(e.currentTarget.value.slice(0, 60))} placeholder="Cognome" /></label>
          <button className="primary-btn" onClick={() => profile.update({ firstName: firstName.trim(), lastName: lastName.trim() })}>Salva modifiche</button>
        </div>
      </div>
    </Panel>
  </main>;
};
