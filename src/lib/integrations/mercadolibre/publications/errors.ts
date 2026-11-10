/**
 * A configuration problem a person can fix.
 *
 * Shared by the store and the runtime so both can throw the one error the
 * command line prints as a sentence instead of a stack trace: "no vehicle with
 * that id" and "no linked account" are the same kind of problem to the person
 * running the command.
 */
export class MeliRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeliRuntimeError";
  }
}
