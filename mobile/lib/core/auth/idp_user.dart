/// Claims do usuário autenticado, já validadas pelo backend (idp-client) -
/// mesmo shape devolvido por `GET /auth/me` (ver skill `idp-client`, mesmo
/// modelo usado no `CurrentUser` do frontend web).
class IdpUser {
  const IdpUser({
    required this.sub,
    required this.email,
    required this.name,
    required this.role,
    required this.system,
  });

  factory IdpUser.fromJson(Map<String, dynamic> json) {
    return IdpUser(
      sub: json['sub'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      role: json['role'] as String?,
      system: json['system'] as String,
    );
  }

  final String sub;
  final String email;
  final String name;
  final String? role;
  final String system;

  // OS-MOBILE-38 (inicialização offline-first) - serializado pro cache
  // local (SessionStorage), pra liberar a UI com o usuário já conhecido
  // sem esperar GET /auth/me numa abertura do app sem rede.
  Map<String, dynamic> toJson() => {
    'sub': sub,
    'email': email,
    'name': name,
    'role': role,
    'system': system,
  };
}
