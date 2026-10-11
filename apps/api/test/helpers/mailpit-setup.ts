import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';

export const MAILPIT_IMAGE = 'axllent/mailpit:v1.27';

export async function startMailpit(): Promise<StartedTestContainer> {
  return new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp('/livez', 8025))
    .start();
}

export async function listMessages(
  mailpit: StartedTestContainer,
): Promise<
  Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }>
> {
  const url = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}/api/v1/messages`;
  const res = await fetch(url);
  const body = (await res.json()) as {
    messages: Array<{
      ID: string;
      Subject: string;
      To: Array<{ Address: string }>;
    }>;
  };
  return body.messages;
}
