import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { strongEnough } from '../utils/validators/password';
import { changePassword } from '../apis/auth';  

export default function useChangePassword({ t, onSuccess }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow]   = useState({ current: false, new: false, confirm: false });
  const [focus, setFocus] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const onChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  const toggle   = (field) => setShow((p) => ({ ...p, [field]: !p[field] }));
  const setFoc   = (field, v) => setFocus((p) => ({ ...p, [field]: v }));

  const submit = async ({ notify }) => {
    const { currentPassword, newPassword, confirmPassword } = form;

    if (!currentPassword || !newPassword || !confirmPassword) {
      notify(t('cp_needAll')); return;
    }
    if (!strongEnough(newPassword) || !strongEnough(confirmPassword)) {
      notify(t('cp_weak')); return;
    }
    if (newPassword !== confirmPassword) {
      notify(t('cp_mismatch')); return;
    }
    if (loading) return;

    try {
      setLoading(true);
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) { notify(t('cp_noToken')); return; }
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) { notify(t('cp_noUserId')); return; }

      await changePassword({ accessToken, userId, oldPassword: currentPassword, newPassword });
      notify(t('cp_success'));
      onSuccess?.();
    } catch (err) {
      let msg = err?.message || t('cp_fail');
      try { const parsed = JSON.parse(err.message); msg = parsed?.message || msg; } catch {}
      notify(msg);
    } finally {
      setLoading(false);
    }
  };

  return { form, show, focus, loading, onChange, toggle, setFoc, submit };
}
