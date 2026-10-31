"""Original Google-only schema, also used as the baseline for existing databases."""

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None


def upgrade():
    op.create_table("users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("google_sub", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("picture", sa.String(1000)),
    )
    op.create_table("events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("code", sa.String(8), nullable=False, unique=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cover_key", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table("members",
        sa.Column("event_id", sa.Integer, sa.ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), primary_key=True),
    )
    op.create_index("ix_members_user_id", "members", ["user_id"])
    op.create_table("photos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer, sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("key", sa.String(200), nullable=False),
        sa.Column("thumb_key", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_photos_event_id", "photos", ["event_id"])
    op.create_table("photo_features",
        sa.Column("photo_id", sa.Integer, sa.ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("phash", sa.String(32), nullable=False),
        sa.Column("sharpness", sa.Float, nullable=False),
        sa.Column("pixels", sa.BigInteger, nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True)),
        sa.Column("embedding", sa.LargeBinary, nullable=False),
    )


def downgrade():
    raise RuntimeError("The original schema contains user data; do not drop it automatically")
