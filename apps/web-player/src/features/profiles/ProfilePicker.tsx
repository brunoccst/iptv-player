import { useState } from 'react';
import { needsPinToManage, needsPinToOpen, type ProfileDto } from '@iptv/shared';
import { stores } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { usePin, useSession } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { AVATAR_COLORS, avatarColor } from './avatar';
import { KidsCategories } from './KidsCategories';
import { LanguageSettings } from './LanguageSettings';
import { usePinGate } from './PinDialog';

const MAX_PROFILES = 5;

/** "Who's watching?" screen. Manage mode edits or deletes profiles. With a parental PIN (D-054), regular profiles and managing ask for it. */
export function ProfilePicker() {
  const profiles = useSession((s) => s.profiles);
  const pinStatus = usePin((s) => s.status);
  const [managing, setManaging] = useState(false);
  const [editing, setEditing] = useState<ProfileDto | 'new' | null>(null);
  // Once the PIN was entered for managing, it is not asked again until the picker closes.
  const [unlocked, setUnlocked] = useState(false);
  const { gate, dialog } = usePinGate();
  const manage = (action: () => void) =>
    gate(needsPinToManage(pinStatus) && !unlocked, 'Enter the parental PIN to manage profiles', () => {
      setUnlocked(true);
      action();
    });

  const select = (profile: ProfileDto) =>
    managing
      ? setEditing(profile)
      : gate(needsPinToOpen(pinStatus, null, profile), `Enter the parental PIN to open ${profile.name}`, () =>
          stores.session.getState().selectProfile(profile.id),
        );

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
            <button type="button" className="profile-tile" onClick={() => manage(() => setEditing('new'))}>
              <span className="profile-tile__avatar profile-tile__avatar--add">
                <Icon name="plus" size={48} />
              </span>
              <span>Add Profile</span>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => (managing ? setManaging(false) : manage(() => setManaging(true)))}
        >
          {managing ? 'Done' : 'Manage Profiles'}
        </button>
      </div>
      {editing ? <ProfileEditor profile={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      {dialog}
    </main>
  );
}

function ProfileEditor({ profile, onClose }: { profile: ProfileDto | null; onClose(): void }) {
  const busy = useSession((s) => s.busy);
  const error = useSession((s) => s.error);
  const [name, setName] = useState(profile?.name ?? '');
  const [isKids, setIsKids] = useState(profile?.isKids ?? false);
  const [color, setColor] = useState(profile ? avatarColor(profile) : AVATAR_COLORS[0]!);
  const [categories, setCategories] = useState(false);
  const [languages, setLanguages] = useState(false);
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
    <Modal
      label={profile ? 'Edit profile' : 'Add profile'}
      onClose={() => {
        session.clearError();
        onClose();
      }}
    >
      <form
        className="profile-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2 style={{ margin: 0 }}>{profile ? 'Edit Profile' : 'Add Profile'}</h2>
        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            className="input"
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="muted" style={{ fontSize: '0.875rem', marginBottom: 6 }}>
            Colour
          </legend>
          <div style={{ display: 'flex', gap: 8 }}>
            {AVATAR_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Colour ${option}`}
                aria-pressed={option === color}
                onClick={() => setColor(option)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 4,
                  background: option,
                  border: option === color ? '3px solid #fff' : '3px solid transparent',
                }}
              />
            ))}
          </div>
        </fieldset>
        <label className="checkbox">
          <input type="checkbox" checked={isKids} onChange={(e) => setIsKids(e.target.checked)} /> Kids profile
        </label>
        {/* Parents pick what a saved Kids profile may see (D-064). */}
        {isKids && profile ? (
          <button type="button" className="button button--ghost" onClick={() => setCategories(true)}>
            <Icon name="pencil" size={18} /> Choose categories
          </button>
        ) : null}
        {/* Also here, so parents can set a Kids profile's languages: its own menu has no settings. */}
        {profile ? (
          <button type="button" className="button button--ghost" onClick={() => setLanguages(true)}>
            <Icon name="subtitles" size={18} /> Choose languages
          </button>
        ) : null}
        {error ? (
          <p className="error-text" role="alert">
            {errorText(error)}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" className="button button--primary" disabled={busy || !name.trim()}>
            Save
          </button>
          {profile ? (
            <button type="button" className="button button--ghost" onClick={() => void remove()} disabled={busy}>
              <Icon name="trash" size={18} /> Delete Profile
            </button>
          ) : null}
        </div>
      </form>
      {languages && profile ? (
        <LanguageSettings profile={{ id: profile.id, name: name.trim() || profile.name }} onClose={() => setLanguages(false)} />
      ) : null}
      {categories && profile ? (
        <KidsCategories profileId={profile.id} name={name.trim() || profile.name} onClose={() => setCategories(false)} />
      ) : null}
    </Modal>
  );
}
