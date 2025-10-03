 
export const PW_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function strongEnough(pw) {
  return PW_RULE.test(pw || '');
}
