import { useState, type InputHTMLAttributes } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Icon } from './Icon';

export function PasswordInput({
  field,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> & {
  field: UseFormRegisterReturn;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-control">
      <Icon name="lock" className="input-symbol" />
      <input {...props} {...field} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} />
      </button>
    </span>
  );
}
