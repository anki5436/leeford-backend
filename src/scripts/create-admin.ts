import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { ZodError } from "zod";
import { closePool, getPool } from "../config/database.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import { hashPassword } from "../services/password.service.js";
import { createAdminSchema } from "../validators/auth.validator.js";

async function ask(prompt: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    return await readline.question(prompt);
  } finally {
    readline.close();
  }
}

async function askHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("This command requires an interactive terminal.");
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (): void => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish();
          reject(new Error("Admin creation cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function createAdmin(): Promise<void> {
  console.log("Create Leeford Admin");
  console.log("--------------------");
  const username = await ask("Username: ");
  const email = await ask("Email: ");
  const password = await askHidden("Password: ");
  const confirmPassword = await askHidden("Confirm Password: ");
  const input = createAdminSchema.parse({ username, email, password, confirmPassword });

  const repository = new AuthRepository(getPool());
  const existing = await repository.adminIdentityExists(input.username, input.email);
  if (existing.username) throw new Error("That username is already in use.");
  if (existing.email) throw new Error("That email address is already in use.");

  const passwordHash = await hashPassword(input.password);
  await repository.createSuperAdmin(input.username, input.email, passwordHash);
  console.log("SUPER_ADMIN account created successfully.");
}

createAdmin()
  .catch((error: unknown) => {
    if (error instanceof ZodError) {
      for (const issue of error.issues) console.error(issue.message);
    } else if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Admin creation failed.");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
