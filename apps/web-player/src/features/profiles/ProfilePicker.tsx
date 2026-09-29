import { useState } from 'react';
import { type ProfileDto, t } from '@iptv/shared';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useProfileEditor, useProfilePicker } from '../../hooks/stores';
import { errorText } from '../../ui/errorText';
import { avatarColor } from './avatar';
import { KidsCategories } from './KidsCategories';
import { LanguageSettings } from './LanguageSettings';
import { usePinGate } from './PinDialog';

/** "Who's watching?" screen. Manage mode edits or deletes profiles. With a parental PIN (D-054), regular profiles and managing ask for it. */
export function ProfilePicker() {
  const { gate, dialog } = usePinGate();
  const { profiles, managing, editing, canAdd, select, add, toggleManaging, closeEditor } = useProfilePicker(gate);

  return (
    <main className="center-screen profiles">
      <div>
        <h1>{managing ? t('Manage Profiles') : t("Who's watching?")}</h1>
        <div className="profiles__grid">
          {profiles.map((profile) => (
            <button key={profile.id} type="button" className="profile-tile" onClick={() => select(profile)}>
              <span className="profile-tile__avatar" style={{ background: avatarColor(profile) }}>
                {managing ? <Icon name="pencil" size={40} /> : profile.name.charAt(0).toUpperCase()}
              </span>
              <span>{profile.name}</span>
              {profile.isKids ? <span className="profile-tile__kids">{t('Kids')}</span> : null}
            </button>
          ))}
          {canAdd ? (
            <button type="button" className="profile-tile" onClick={add}>
              <span className="profile-tile__avatar profile-tile__avatar--add">
                <Icon name="plus" size={48} />
              </span>
              <span>{t('Add Profile')}</span>
            </button>
          ) : null}
        </div>
        <button type="button" className="button button--ghost" onClick={toggleManaging}>
          {managing ? t('Done') : t('Manage Profiles')}
        </button>
      </div>
      {editing ? <ProfileEditor profile={editing === 'new' ? null : editing} onClose={closeEditor} /> : null}
      {dialog}
    </main>
  );
}

function ProfileEditor({ profile, onClose }: { profile: ProfileDto | null; onClose(): void }) {
  const { busy, error, name, setName, isKids, setIsKids, color, setColor, colors, save, remove, close } = useProfileEditor(
    profile,
    onClose,
  );
  const [categories, setCategories] = useState(false);
  const [languages, setLanguages] = useState(false);

  return (
    <Modal label={profile ? t('Edit profile') : t('Add profile')} onClose={close}>
      <form
        className="profile-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2 style={{ margin: 0 }}>{profile ? t('Edit Profile') : t('Add Profile')}</h2>
        <div className="field">
          <label htmlFor="profile-name">{t('Name')}</label>
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
            {t('Colour')}
          </legend>
          <div style={{ display: 'flex', gap: 8 }}>
            {colors.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={t('Colour {option}', { option })}
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
          <input type="checkbox" checked={isKids} onChange={(e) => setIsKids(e.target.checked)} /> {t('Kids profile')}
        </label>
        {/* Parents pick what a saved Kids profile may see (D-064). */}
        {isKids && profile ? (
          <button type="button" className="button button--ghost" onClick={() => setCategories(true)}>
            <Icon name="pencil" size={18} /> {t('Choose categories')}
          </button>
        ) : null}
        {/* Also here, so parents can set a Kids profile's languages: its own menu has no settings. */}
        {profile ? (
          <button type="button" className="button button--ghost" onClick={() => setLanguages(true)}>
            <Icon name="subtitles" size={18} /> {t('Content language filter')}
          </button>
        ) : null}
        {error ? (
          <p className="error-text" role="alert">
            {errorText(error)}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" className="button button--primary" disabled={busy || !name.trim()}>
            {t('Save')}
          </button>
          {profile ? (
            <button type="button" className="button button--ghost" onClick={() => void remove()} disabled={busy}>
              <Icon name="trash" size={18} /> {t('Delete Profile')}
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
