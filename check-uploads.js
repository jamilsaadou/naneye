import { existsSync, mkdirSync, readdirSync, statSync, accessSync, constants } from 'fs';
import { join } from 'path';

const uploadDir = join(process.cwd(), 'public', 'uploads');

console.log('🔍 Vérification du dossier uploads...\n');
console.log('═══════════════════════════════════════════\n');

// 1. Vérifier le chemin
console.log('📁 Informations du dossier:');
console.log(`   Chemin: ${uploadDir}`);
console.log(`   Existe: ${existsSync(uploadDir) ? '✅ Oui' : '❌ Non'}\n`);

if (!existsSync(uploadDir)) {
  console.log('❌ Le dossier n\'existe pas!');
  console.log('💡 Exécutez: ./setup-uploads.sh\n');
  process.exit(1);
}

// 2. Vérifier les permissions
try {
  const stats = statSync(uploadDir);
  const mode = (stats.mode & parseInt('777', 8)).toString(8);

  console.log('🔒 Permissions:');
  console.log(`   Mode: ${mode}`);
  console.log(`   Propriétaire: UID ${stats.uid}, GID ${stats.gid}`);

  // Vérifier les accès
  try {
    accessSync(uploadDir, constants.R_OK);
    console.log('   Lecture: ✅ OK');
  } catch {
    console.log('   Lecture: ❌ ERREUR');
  }

  try {
    accessSync(uploadDir, constants.W_OK);
    console.log('   Écriture: ✅ OK');
  } catch {
    console.log('   Écriture: ❌ ERREUR');
  }

  console.log('');
} catch (error) {
  console.log(`❌ Erreur lors de la lecture des permissions: ${error.message}\n`);
}

// 3. Lister les fichiers
try {
  const files = readdirSync(uploadDir);
  console.log('📝 Contenu du dossier:');
  console.log(`   Nombre de fichiers: ${files.length}`);

  if (files.length > 0) {
    console.log('   Fichiers:');
    files.slice(0, 10).forEach(file => {
      const filePath = join(uploadDir, file);
      const stats = statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`     - ${file} (${size} KB)`);
    });

    if (files.length > 10) {
      console.log(`     ... et ${files.length - 10} autres fichiers`);
    }
  } else {
    console.log('   ⚠️  Aucun fichier (normal pour une nouvelle installation)');
  }
  console.log('');
} catch (error) {
  console.log(`❌ Erreur lors de la lecture du contenu: ${error.message}\n`);
}

// 4. Test d'écriture
try {
  const testFile = join(uploadDir, '.test-write');
  const { writeFileSync, unlinkSync } = await import('fs');

  console.log('✍️  Test d\'écriture:');
  writeFileSync(testFile, 'test');
  console.log('   Écriture: ✅ OK');

  unlinkSync(testFile);
  console.log('   Suppression: ✅ OK\n');
} catch (error) {
  console.log(`   ❌ ERREUR: ${error.message}\n`);
}

// 5. Recommandations
console.log('═══════════════════════════════════════════\n');
console.log('💡 Recommandations:\n');

const files = readdirSync(uploadDir);
if (files.length === 0 || (files.length === 1 && files[0] === '.gitkeep')) {
  console.log('   ℹ️  Aucun fichier uploadé pour le moment');
  console.log('   → Uploadez une photo via l\'interface pour tester\n');
}

try {
  accessSync(uploadDir, constants.W_OK);
  console.log('   ✅ Le dossier est configuré correctement!\n');
} catch {
  console.log('   ⚠️  Problème de permissions détecté');
  console.log('   → Exécutez: ./setup-uploads.sh\n');
}

console.log('═══════════════════════════════════════════\n');

// 6. Instructions pour tester en production
console.log('🌐 Pour tester l\'accès HTTP:\n');
console.log('   # En local:');
console.log('   curl -I http://localhost:3000/uploads/.gitkeep\n');
console.log('   # En production:');
console.log('   curl -I https://votre-domaine.com/uploads/.gitkeep\n');
console.log('   → Devrait retourner: 200 OK\n');
