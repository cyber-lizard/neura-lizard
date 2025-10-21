import os
os.environ["DB_URL"] = "sqlite:///:memory:"

from neuralizard.db import init_db, session

def test_init_db():
    init_db()
    with session() as s:
        assert s is not None
