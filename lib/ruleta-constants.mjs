export const ALLOWED_PRIZE_IDS = new Set([
  'bono_oro',
  'bono_plata',
  'bono_bronce',
  'pase_vip',
  'beneficio_plus',
  'pase_fundador',
  'copa_stand',
  'charla_dueno',
  'botella_regalo',
  'sin_premio'
]);

export const PRIZE_CODE_PREFIX = {
  bono_oro: 'VR-ORO',
  bono_plata: 'VR-PLA',
  bono_bronce: 'VR-BRO',
  botella_regalo: 'VR-BOT',
  pase_vip: 'VR-VIP',
  beneficio_plus: 'VR-PLUS',
  pase_fundador: 'VR-FUND',
  copa_stand: 'VR-COPA',
  charla_dueno: 'VR-CHAT'
};

export const CUPON_VIGENCIA_MESES = 2;

export function prizeEmiteCupon(prizeId) {
  return prizeId !== 'sin_premio';
}
