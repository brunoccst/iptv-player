import { useState } from 'react';
import type { ProfileDto } from '@iptv/shared';
import { stores } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useSession } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { AVATAR_COLORS, avatarColor } from './avatar';

const MAX_PROFILES = 5;

/** "Who's watching?" screen. Manage mode edits or deletes profiles. */
export function ProfilePicker() {
  const profiles = useSession((s) => s.profiles);
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<ProfileDto | 'new' | null>(null);

  const select = (profile: ProfileDto) => (managing ? setEditing(profile) : stores.session.getState().selectProfile(profile.id));

  return (
    <main className="center-screen profiles">
      <div>
        <h1>{managing ? 'Manage Profiles' : "Who's watching?"}</h1>
        <div className="profiles__grid">
          {profiles.map((profile) => (
            <button key={profile.id} type="button" className="profile-tile" onClick={() => select(profile)}>
              <span className="profile-tile__avatar" style={{ background: avatarColor(profile) }}>
                {managing ? <Icon name="pencil" size={40} /> : profile.name.charAt(0).toUpperCase()}
              </span>
              <span>{profile.name}</span>
              {profile.isKids ? <span className="profile-tile__kids">Kids</span> : null}
            </button>
          ))}
          {profiles.length < MAX_PROFILES ? (
            <button type="button" className="profile-tile" onClick={() => setEditing('new')}>
              <span className="profile-tile__avatar profile-tile__avatar--add">
                <Icon name="plus" size={48} />
              </span>
              <span>Add Profile</span>
            </button>
          ) : null}
        </div>
        <button type="button" className="button button--ghost" onClick={() => setManaging(!managing)}>
          {managing ? 'Done' : 'Manage Profiles'}
        </button>
      </div>
      {editing ? <ProfileEditor profile={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </main>
  );
}

function ProfileEditor({ profile, onClose }: { profile: ProfileDto | null; onClose(): void }) {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const [name, setName] = useState(profile?.name ?? '');
  const [isKids, setIsKids] = useState(profile?.isKids ?? false);
  const [color, setColor] = useState(profile ? avatarColor(profile) : AVATAR_COLORS[0]!);
  const session = stores.session.getState();

  const save = async () => {
    const request = { name: name.trim(), isKids, avatarKey: color };
    const saved = profile ? await session.updateProfile(profile.id, request) : await session.createProfile(request);
    if (saved) onClose();
  };

  const remove = async () => {
    if (profile && (await session.deleteProfile(profile.id))) onClose();
  };

  return (
    <Modal label={profile ? 'Edit profile' : 'Add profile'} onClose={() => { session.clearError(); onClose(); }}>
      <form className="profile-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <h2 style={{ margin: 0 }}>{profile ? 'Edit Profile' : 'Add Profile'}</h2>
        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input id="profile-name" className="input" required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="muted" style={{ fontSize: '0.875rem', marginBottom: 6 }}>Colour</legend>
          <div style={{ display: 'flex', gap: 8 }}>
            {AVATAR_COLORS.map((option) => (
              <button key={option} type="button" aria-label={`Colour ${option}`} aria-pressed={option === color} onClick={() => setColor(option)}
                style={{ width: 36, height: 36, borderRadius: 4, background: option, border: option === color ? '3px solid #fff' : '3px solid transparent' }} />
            ))}
          </div>
        </fieldset>
        <label className="checkbox">
          <input type="checkbox" checked={isKids} onChange={(e) => setIsKids(e.target.checked)} /> Kids profile
        </label>
        {error ? <p className="error-text" role="alert">{errorText(error)}</p> : null}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" className="button button--primary" disabled={busy || !name.trim()}>Save</button>
          {profile ? (
            <button type="button" className="button button--ghost" onClick={() => void remove()} disabled={busy}>
              <Icon name="trash" size={18} /> Delete Profile
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
