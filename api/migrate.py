"""Upgrade fresh and pre-Alembic RollCall databases without resetting user data."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text


def migrate_database(engine):
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).with_name("migrations")))
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_xact_lock(726655225)"))
        config.attributes["connection"] = connection
        tables = inspect(connection).get_table_names()
        if "users" in tables and "alembic_version" not in tables:
            command.stamp(config, "0001")
        command.upgrade(config, "head")


if __name__ == "__main__":
    from main import engine

    migrate_database(engine)
