/**
 * Templates de WhatsApp — español mexicano, tuteo, sin emojis ni signos de
 * exclamación (decisión de marca del CEO). Mensajes transaccionales: dicen
 * qué pasó y qué hacer, nada de marketing.
 */

export const templates = {
  tripOptionsReady: (params: {
    fullName: string;
    destination: string;
    optionCount: number;
    tripUrl: string;
  }) =>
    `Hola ${params.fullName}, tu viaje a ${params.destination} ya tiene ${params.optionCount} opciones listas. Entra a TORA para elegirlas: ${params.tripUrl}`,

  depositValidated: (params: { fullName: string; amount: string }) =>
    `Hola ${params.fullName}, tu depósito de $${params.amount} MXN fue validado. Tu saldo está actualizado.`,

  tripConfirmed: (params: {
    fullName: string;
    destination: string;
    departureDate: string;
  }) =>
    `Hola ${params.fullName}, tu viaje a ${params.destination} del ${params.departureDate} está confirmado.`,

  creditApproved: (params: {
    fullName: string;
    destination: string;
    dueDate: string;
  }) =>
    `Hola ${params.fullName}, el viaje a ${params.destination} fue cargado a tu línea de crédito. Vence el ${params.dueDate}.`,

  paymentReminder: (params: {
    fullName: string;
    amount: string;
    dueDate: string;
    daysLeft: number;
  }) =>
    `Hola ${params.fullName}, tu pago de $${params.amount} MXN vence en ${params.daysLeft} días (${params.dueDate}). Contacta a TORA si necesitas asistencia.`,

  tripSuspended: (params: { fullName: string; destination: string }) =>
    `Hola ${params.fullName}, tu viaje a ${params.destination} fue suspendido por mora. Contacta a TORA para regularizar tu cuenta.`,
};
