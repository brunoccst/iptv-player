export function Spinner({ small = false, label = 'Loading' }: { small?: boolean; label?: string }) {
  return (
    <div role="status" className={small ? 'spinner spinner--small' : 'spinner'}>
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
