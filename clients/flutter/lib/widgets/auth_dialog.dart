import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/music_provider.dart';

class AuthDialog extends StatefulWidget {
  final String title;
  final String subtitle;

  const AuthDialog({
    super.key,
    this.title = 'Sign In to NILORA',
    this.subtitle = 'Create a free account or sign in to download songs and sync your favorites.',
  });

  static Future<void> show(
    BuildContext context, {
    String title = 'Sign In to NILORA',
    String subtitle = 'Create a free account or sign in to download songs and sync your favorites.',
  }) {
    return showDialog(
      context: context,
      builder: (ctx) => AuthDialog(title: title, subtitle: subtitle),
    );
  }

  @override
  State<AuthDialog> createState() => _AuthDialogState();
}

class _AuthDialogState extends State<AuthDialog> {
  bool _isSignUp = false;
  bool _isVerifying = false;

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _otpController = TextEditingController();

  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() => _errorMessage = null);
    final auth = context.read<AuthProvider>();
    final music = context.read<MusicProvider>();

    try {
      if (_isVerifying) {
        await auth.verify(
          email: _emailController.text.trim(),
          code: _otpController.text.trim(),
        );
        await music.syncLikes(isAuthenticated: true);
        if (mounted) Navigator.of(context).pop();
      } else if (_isSignUp) {
        final res = await auth.signup(
          name: _nameController.text.trim(),
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
        setState(() {
          _isVerifying = true;
          // In dev mode, the backend may expose OTP code
          if (res['devCode'] != null) {
            _otpController.text = res['devCode'].toString();
          }
        });
      } else {
        await auth.login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
        await music.syncLikes(isAuthenticated: true);
        if (mounted) Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('ApiException: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return AlertDialog(
      backgroundColor: const Color(0xFF1E1E28),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _isVerifying ? 'Enter Verification Code' : widget.title,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
          ),
          const SizedBox(height: 6),
          Text(
            _isVerifying
                ? 'We sent a 6-digit confirmation code to ${_emailController.text.trim()}'
                : widget.subtitle,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(10),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.redAccent.withOpacity(0.5)),
                ),
                child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
              ),
            if (_isVerifying)
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, letterSpacing: 4, fontSize: 20),
                textAlign: TextAlign.center,
                decoration: const InputDecoration(
                  hintText: '000000',
                  hintStyle: TextStyle(color: Colors.white30, letterSpacing: 4),
                  filled: true,
                  fillColor: Color(0xFF282836),
                  border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
                ),
              )
            else ...[
              if (_isSignUp)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TextField(
                    controller: _nameController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Your Name',
                      labelStyle: TextStyle(color: Colors.white60),
                      prefixIcon: Icon(Icons.person_outline, color: Colors.white60),
                      filled: true,
                      fillColor: Color(0xFF282836),
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
                    ),
                  ),
                ),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Email Address',
                  labelStyle: TextStyle(color: Colors.white60),
                  prefixIcon: Icon(Icons.email_outlined, color: Colors.white60),
                  filled: true,
                  fillColor: Color(0xFF282836),
                  border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: 'Password',
                  labelStyle: TextStyle(color: Colors.white60),
                  prefixIcon: Icon(Icons.lock_outline, color: Colors.white60),
                  filled: true,
                  fillColor: Color(0xFF282836),
                  border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        if (!_isVerifying)
          TextButton(
            onPressed: () {
              setState(() {
                _isSignUp = !_isSignUp;
                _errorMessage = null;
              });
            },
            child: Text(
              _isSignUp ? 'Have an account? Sign In' : 'New here? Create Account',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6366F1),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          onPressed: auth.isLoading ? null : _handleSubmit,
          child: auth.isLoading
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(_isVerifying ? 'Verify' : (_isSignUp ? 'Sign Up' : 'Sign In')),
        ),
      ],
    );
  }
}
