"""Guest identities and revocable event invitations."""

import secrets

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.alter_column("google_sub", existing_type=sa.String(64), nullable=True)
        batch.alter_column("email", existing_type=sa.String(320), nullable=True)
    op.add_column("events", sa.Column("invite_token", sa.String(64), nullable=True))
    op.add_column("events", sa.Column("invites_open", sa.Boolean, nullable=False, server_default=sa.true()))
    op.add_column("events", sa.Column("uploads_open", sa.Boolean, nullable=False, server_default=sa.true()))
    events = sa.table("events", sa.column("id", sa.Integer), sa.column("invite_token", sa.String(64)))
    connection = op.get_bind()
    for event_id in connection.execute(sa.select(events.c.id)).scalars().all():
        connection.execute(events.update().where(events.c.id == event_id).values(invite_token=secrets.token_urlsafe(24)))
    with op.batch_alter_table("events") as batch:
        batch.alter_column("invite_token", existing_type=sa.String(64), nullable=False)
        batch.create_unique_constraint("uq_events_invite_token", ["invite_token"])


def downgrade():
    raise RuntimeError("Guest identities cannot be removed without losing attribution; restore a backup instead")
