// screens/Home/CompanyStyles.js
import { StyleSheet, Platform } from 'react-native';

export const PRIMARY = '#1e88e5';
const BORDER  = '#e5e7eb';
const TEXT    = '#0f172a';
const MUTED   = '#667085';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },

  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 20 : 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 6, marginRight: 6 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  headerBtn: { padding: 6 },

  notificationContainer: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -7,
    right: -7,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  /* Body KHÔNG SCROLL: co giãn gọn trong 1 màn */
  bodyStatic: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    justifyContent: 'space-between', // chia đều theo chiều dọc
  },

  /* Card trung tâm (logo + tên) – gọn hơn để khỏi tràn */
  cardCenter: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: { width: 96, height: 96, marginBottom: 6 }, // ↓ size để vừa 1 màn
  companyName: {
    fontSize: 15,
    fontWeight: '800',
    color: PRIMARY,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Card danh sách info */
  cardList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },

  row: {
    minHeight: 50,                 
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 12, color: MUTED, marginBottom: 2, fontWeight: '700' },
  rowValue: { fontSize: 14, color: TEXT },

  divider: { height: 1, backgroundColor: BORDER, marginLeft: 50 },

  /* Ghost button (đóng) */
  ghostBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: BORDER,
    marginTop: 10,
  },
  ghostBtnText: { color: TEXT, fontSize: 15, fontWeight: '700' },
});

export default styles;
