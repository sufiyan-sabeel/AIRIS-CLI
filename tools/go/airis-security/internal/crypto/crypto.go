package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const keyLength = 32

func deriveKey(material []byte) []byte {
	if len(material) >= keyLength {
		return material[:keyLength]
	}
	key := make([]byte, keyLength)
	copy(key, material)
	return key
}

func EncryptFile(inPath, outPath string, keyMaterial []byte) error {
	if err := validatePath(inPath); err != nil {
		return err
	}

	key := deriveKey(keyMaterial)
	plaintext, err := os.ReadFile(inPath)
	if err != nil {
		return fmt.Errorf("read input: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("aes init: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("gcm init: %w", err)
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("nonce: %w", err)
	}

	ciphertext := aesGCM.Seal(nonce, nonce, plaintext, nil)

	dir := filepath.Dir(outPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("mkdir: %w", err)
		}
	}

	if err := os.WriteFile(outPath, ciphertext, 0644); err != nil {
		return fmt.Errorf("write output: %w", err)
	}

	return nil
}

func DecryptFile(inPath, outPath string, keyMaterial []byte) error {
	if err := validatePath(inPath); err != nil {
		return err
	}

	key := deriveKey(keyMaterial)
	ciphertext, err := os.ReadFile(inPath)
	if err != nil {
		return fmt.Errorf("read input: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("aes init: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("gcm init: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return fmt.Errorf("decrypt: %w", err)
	}

	dir := filepath.Dir(outPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("mkdir: %w", err)
		}
	}

	if err := os.WriteFile(outPath, plaintext, 0644); err != nil {
		return fmt.Errorf("write output: %w", err)
	}

	return nil
}

func validatePath(path string) error {
	if path == "" {
		return errors.New("path is empty")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("bad path: %w", err)
	}
	cleaned := filepath.Clean(abs)
	if cleaned != abs {
		return fmt.Errorf("path is not canonical: %s", path)
	}
	return nil
}

var _ = hex.EncodeToString
