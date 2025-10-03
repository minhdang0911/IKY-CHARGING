import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Nếu m đã có getDevices trong ../../apis/devices thì import:
import { getDevices } from '../apis/devices'; // chỉnh path nếu khác

export default function useAgentInfo(deps = []) {
  const [agentInfo, setAgentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setLoadErr('');
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          setLoadErr('notLogged'); // key i18n
          setLoading(false);
          return;
        }
        // gọi API
        const res = await getDevices(token);
        if (!mounted) return;

        const list = Array.isArray(res?.data) ? res.data : [];
        let agent = null;
        for (const d of list) { if (d?.agent_id) { agent = d.agent_id; break; } }
        setAgentInfo(agent || null);
      } catch (e) {
        setLoadErr(e?.message || 'Error');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { agentInfo, loading, loadErr };
}
