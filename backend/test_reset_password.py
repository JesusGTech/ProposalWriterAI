import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import HTTPException

# Import the API without loading real credentials or contacting external services.
with patch("dotenv.load_dotenv"), patch("supabase.create_client"), patch.dict(
    os.environ, {"ANTHROPIC_API_KEY": "test-key"}
):
    from backend import main


class ResetPasswordTests(unittest.TestCase):
    def setUp(self):
        self.factory_patch = patch.object(main, "create_client")
        self.factory = self.factory_patch.start()
        self.addCleanup(self.factory_patch.stop)
        self.client = self.factory.return_value
        self.client.auth.set_session.return_value = SimpleNamespace(
            user=SimpleNamespace(id="existing-pro-user"), session=object()
        )
        self.request = main.ResetPasswordRequest(
            access_token="recovery-access", refresh_token="recovery-refresh",
            new_password="new-test-password",
        )

    def test_updates_existing_user_without_admin_permissions(self):
        self.assertEqual(main.reset_password(self.request), {"message": "Password updated"})
        self.client.auth.set_session.assert_called_once_with("recovery-access", "recovery-refresh")
        self.client.auth.update_user.assert_called_once_with({"password": "new-test-password"})
        self.client.auth.admin.update_user_by_id.assert_not_called()
        self.client.table.assert_not_called()
        options = self.factory.call_args.kwargs["options"]
        self.assertFalse(options.auto_refresh_token)
        self.assertFalse(options.persist_session)

    def test_invalid_recovery_session_cannot_update_password(self):
        self.client.auth.set_session.side_effect = Exception("private token details")
        with self.assertRaises(HTTPException) as caught:
            main.reset_password(self.request)
        self.assertEqual(caught.exception.status_code, 401)
        self.assertNotIn("private", caught.exception.detail)
        self.client.auth.update_user.assert_not_called()

    def test_missing_session_cannot_update_password(self):
        self.client.auth.set_session.return_value = SimpleNamespace(user=None, session=None)
        with self.assertRaises(HTTPException):
            main.reset_password(self.request)
        self.client.auth.update_user.assert_not_called()

    def test_password_rejection_does_not_report_success(self):
        error = Exception("private provider details")
        error.code = "same_password"
        self.client.auth.update_user.side_effect = error
        with self.assertRaises(HTTPException) as caught:
            main.reset_password(self.request)
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("different", caught.exception.detail)


if __name__ == "__main__":
    unittest.main()
