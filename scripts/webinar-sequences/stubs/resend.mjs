// Faux client Resend : au lieu d'envoyer, il enregistre la charge utile.
// Utilisé uniquement par build.mjs pour capturer ce que la landing enverrait.
export class Resend {
  constructor() {
    this.emails = {
      send: async (body) => {
        (globalThis.__seqCapture ??= []).push(body);
        return { data: { id: 'preview' }, error: null };
      },
    };
  }
}
